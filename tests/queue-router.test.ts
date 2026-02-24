import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Queue } from '@cloudflare/workers-types'
import { QueueRouter } from '../src/queue-router'
import { isActionMessage } from '../src/types'

type TestQueues = {
    TEST_QUEUE: Queue<{ action: 'test-action'; data: string }>
    USER_QUEUE: Queue<{ action: 'create-user'; userId: string }>
}

class FakeMessageCollector {
    messages: unknown[] = []
    batches: unknown[][] = []

    single = (body: unknown) => {
        this.messages.push(body)
    }
    multi = (bodies: unknown[]) => {
        this.batches.push(bodies)
    }
    clear() {
        this.messages = []
        this.batches = []
    }
}

function createBatch(queueName: string, messages: { action: string; [key: string]: unknown }[]) {
    return {
        queue: queueName,
        messages: messages.map(body => ({
            body,
            ack: vi.fn(),
            retry: vi.fn(),
        })),
    }
}

describe('QueueRouter', () => {
    let router: QueueRouter<{ Queues: TestQueues }>
    let collector: FakeMessageCollector

    beforeEach(() => {
        collector = new FakeMessageCollector()
    })

    describe('binding-based routing (no config)', () => {
        beforeEach(() => {
            router = new QueueRouter<{ Queues: TestQueues }>()
        })

        it('should route by binding when no queue config provided', async () => {
            router.action('TEST_QUEUE', 'test-action', collector.single)

            const batch = createBatch('any-queue-name-prod', [
                { action: 'test-action', data: 'hello' },
            ])

            await router.queue(batch as any)

            expect(collector.messages).toEqual([{ action: 'test-action', data: 'hello' }])
        })

        it('should support explicit queue mapping', async () => {
            router
                .mapQueue('user-queue-stage', 'USER_QUEUE')
                .action('USER_QUEUE', 'create-user', collector.single)

            const batch = createBatch('user-queue-stage', [{ action: 'create-user', userId: 'u1' }])

            await router.queue(batch as any)

            expect(collector.messages).toEqual([{ action: 'create-user', userId: 'u1' }])
        })
    })

    describe('legacy config-based routing', () => {
        beforeEach(() => {
            router = new QueueRouter<{ Queues: TestQueues }>({
                TEST_QUEUE: { name: 'test-queue' },
                USER_QUEUE: { name: 'user-queue' },
            })
        })

        it('should route by queue name when config provided', async () => {
            router.action('TEST_QUEUE', 'test-action', collector.single)

            const batch = createBatch('test-queue', [{ action: 'test-action', data: 'test' }])

            await router.queue(batch as any)

            expect(collector.messages).toHaveLength(1)
        })
    })

    describe('dynamic queue names', () => {
        it('should support function-based queue names', async () => {
            type Env = { STAGE: string }

            router = new QueueRouter<{ Queues: TestQueues; Bindings: Env }>({
                TEST_QUEUE: { name: env => `test-queue-${(env as Env).STAGE}` },
            })

            router.action('TEST_QUEUE', 'test-action', collector.single)

            const batch = createBatch('test-queue-prod', [
                { action: 'test-action', data: 'dynamic' },
            ])

            await router.queue(batch as any, { STAGE: 'prod' })

            expect(collector.messages).toEqual([{ action: 'test-action', data: 'dynamic' }])
        })
    })

    describe('single message handlers', () => {
        beforeEach(() => {
            router = new QueueRouter<{ Queues: TestQueues }>()
        })

        it('should call handler for each message', async () => {
            router.action('TEST_QUEUE', 'test-action', collector.single)

            const batch = createBatch('test-queue', [
                { action: 'test-action', data: 'one' },
                { action: 'test-action', data: 'two' },
            ])

            await router.queue(batch as any)

            expect(collector.messages).toHaveLength(2)
        })
    })

    describe('batch handlers', () => {
        beforeEach(() => {
            router = new QueueRouter<{ Queues: TestQueues }>()
        })

        it('should batch messages for multi handler', async () => {
            router.batch('USER_QUEUE', 'create-user', collector.multi)

            const batch = createBatch('user-queue', [
                { action: 'create-user', userId: 'u1' },
                { action: 'create-user', userId: 'u2' },
                { action: 'create-user', userId: 'u3' },
            ])

            await router.queue(batch as any)

            expect(collector.batches).toHaveLength(1)
            expect(collector.batches[0]).toHaveLength(3)
        })
    })

    describe('method chaining', () => {
        it('should support fluent API', () => {
            const result = new QueueRouter<{ Queues: TestQueues }>()
                .action('TEST_QUEUE', 'test-action', () => {})
                .batch('USER_QUEUE', 'create-user', () => {})
                .mapQueue('custom-queue', 'TEST_QUEUE')

            expect(result).toBeInstanceOf(QueueRouter)
        })
    })

    // ============================================================
    // PRIO 1: Critical fixes
    // ============================================================

    describe('C1: batch handler failure should NOT retry single-handled messages', () => {
        it('should ack single-handled messages immediately, only retry batch-pending on failure', async () => {
            type MixedQueues = {
                MY_QUEUE: Queue<
                    | { action: 'single-action'; data: string }
                    | { action: 'batch-action'; id: number }
                >
            }

            const mixedRouter = new QueueRouter<{ Queues: MixedQueues }>()
            const singleHandler = vi.fn()
            const batchHandler = vi.fn().mockRejectedValue(new Error('batch failed'))

            mixedRouter
                .action('MY_QUEUE', 'single-action', singleHandler)
                .batch('MY_QUEUE', 'batch-action', batchHandler)

            const batch = createBatch('my-queue', [
                { action: 'single-action', data: 'ok' },
                { action: 'batch-action', id: 1 },
                { action: 'batch-action', id: 2 },
            ])

            await mixedRouter.queue(batch as any)

            // Single-handled message should be acked (not retried)
            expect(batch.messages[0].ack).toHaveBeenCalledOnce()
            expect(batch.messages[0].retry).not.toHaveBeenCalled()

            // Batch-pending messages should be retried (batch handler failed)
            expect(batch.messages[1].retry).toHaveBeenCalledOnce()
            expect(batch.messages[1].ack).not.toHaveBeenCalled()
            expect(batch.messages[2].retry).toHaveBeenCalledOnce()
            expect(batch.messages[2].ack).not.toHaveBeenCalled()
        })
    })

    describe('H2: unknown action handling', () => {
        it('should retry unknown actions by default (not silently ack)', async () => {
            router = new QueueRouter<{ Queues: TestQueues }>()
            router.action('TEST_QUEUE', 'test-action', collector.single)

            const batch = createBatch('test-queue', [
                { action: 'unknown-action', data: 'mystery' },
            ])

            await router.queue(batch as any)

            expect(batch.messages[0].retry).toHaveBeenCalledOnce()
            expect(batch.messages[0].ack).not.toHaveBeenCalled()
        })

        it('should ack unknown actions when onUnhandled is "ack"', async () => {
            router = new QueueRouter<{ Queues: TestQueues }>(undefined, { onUnhandled: 'ack' })
            router.action('TEST_QUEUE', 'test-action', collector.single)

            const batch = createBatch('test-queue', [
                { action: 'unknown-action', data: 'mystery' },
            ])

            await router.queue(batch as any)

            expect(batch.messages[0].ack).toHaveBeenCalledOnce()
            expect(batch.messages[0].retry).not.toHaveBeenCalled()
        })

        it('should call custom fallback handler for unknown actions', async () => {
            const fallback = vi.fn()
            router = new QueueRouter<{ Queues: TestQueues }>(undefined, { onUnhandled: fallback })
            router.action('TEST_QUEUE', 'test-action', collector.single)

            const batch = createBatch('test-queue', [
                { action: 'unknown-action', data: 'mystery' },
            ])

            await router.queue(batch as any)

            expect(fallback).toHaveBeenCalledWith({ action: 'unknown-action', data: 'mystery' })
            expect(batch.messages[0].ack).toHaveBeenCalledOnce()
        })
    })

    describe('runtime validation', () => {
        it('should retry messages with missing action field', async () => {
            router = new QueueRouter<{ Queues: TestQueues }>()
            router.action('TEST_QUEUE', 'test-action', collector.single)

            const batch = {
                queue: 'test-queue',
                messages: [
                    { body: { data: 'no-action' }, ack: vi.fn(), retry: vi.fn() },
                ],
            }

            await router.queue(batch as any)

            expect(batch.messages[0].retry).toHaveBeenCalledOnce()
            expect(batch.messages[0].ack).not.toHaveBeenCalled()
        })

        it('should retry messages with non-string action field', async () => {
            router = new QueueRouter<{ Queues: TestQueues }>()
            router.action('TEST_QUEUE', 'test-action', collector.single)

            const batch = {
                queue: 'test-queue',
                messages: [
                    { body: { action: 123 }, ack: vi.fn(), retry: vi.fn() },
                ],
            }

            await router.queue(batch as any)

            expect(batch.messages[0].retry).toHaveBeenCalledOnce()
        })

        it('should retry messages with empty action string', async () => {
            router = new QueueRouter<{ Queues: TestQueues }>()
            router.action('TEST_QUEUE', 'test-action', collector.single)

            const batch = {
                queue: 'test-queue',
                messages: [
                    { body: { action: '' }, ack: vi.fn(), retry: vi.fn() },
                ],
            }

            await router.queue(batch as any)

            expect(batch.messages[0].retry).toHaveBeenCalledOnce()
        })

        it('should retry messages with null body', async () => {
            router = new QueueRouter<{ Queues: TestQueues }>()
            router.action('TEST_QUEUE', 'test-action', collector.single)

            const batch = {
                queue: 'test-queue',
                messages: [
                    { body: null, ack: vi.fn(), retry: vi.fn() },
                ],
            }

            await router.queue(batch as any)

            expect(batch.messages[0].retry).toHaveBeenCalledOnce()
        })
    })

    // ============================================================
    // PRIO 2: Error-path tests
    // ============================================================

    describe('error handling', () => {
        it('should retry message when single handler throws', async () => {
            router = new QueueRouter<{ Queues: TestQueues }>()
            router.action('TEST_QUEUE', 'test-action', () => {
                throw new Error('handler exploded')
            })

            const batch = createBatch('test-queue', [
                { action: 'test-action', data: 'boom' },
            ])

            await router.queue(batch as any)

            expect(batch.messages[0].retry).toHaveBeenCalledOnce()
            expect(batch.messages[0].ack).not.toHaveBeenCalled()
        })

        it('should retry all batch messages when batch handler throws', async () => {
            router = new QueueRouter<{ Queues: TestQueues }>()
            router.batch('USER_QUEUE', 'create-user', () => {
                throw new Error('batch exploded')
            })

            const batch = createBatch('user-queue', [
                { action: 'create-user', userId: 'u1' },
                { action: 'create-user', userId: 'u2' },
            ])

            await router.queue(batch as any)

            expect(batch.messages[0].retry).toHaveBeenCalledOnce()
            expect(batch.messages[1].retry).toHaveBeenCalledOnce()
        })

        it('should retry all messages when no binding is found', async () => {
            type MultiQueues = {
                Q1: Queue<{ action: 'a'; x: string }>
                Q2: Queue<{ action: 'b'; y: string }>
            }

            const multiRouter = new QueueRouter<{ Queues: MultiQueues }>()
            multiRouter.action('Q1', 'a', () => {})
            multiRouter.action('Q2', 'b', () => {})

            // Multiple bindings, no explicit mapping → can't auto-resolve
            const batch = createBatch('unknown-queue', [
                { action: 'a', x: '1' },
            ])

            await multiRouter.queue(batch as any)

            expect(batch.messages[0].retry).toHaveBeenCalledOnce()
        })
    })

    describe('ack/retry verification', () => {
        it('should ack all messages on successful processing', async () => {
            router = new QueueRouter<{ Queues: TestQueues }>()
            router.action('TEST_QUEUE', 'test-action', collector.single)

            const batch = createBatch('test-queue', [
                { action: 'test-action', data: 'one' },
                { action: 'test-action', data: 'two' },
            ])

            await router.queue(batch as any)

            expect(batch.messages[0].ack).toHaveBeenCalledOnce()
            expect(batch.messages[1].ack).toHaveBeenCalledOnce()
            expect(batch.messages[0].retry).not.toHaveBeenCalled()
            expect(batch.messages[1].retry).not.toHaveBeenCalled()
        })

        it('should ack batch messages on successful batch processing', async () => {
            router = new QueueRouter<{ Queues: TestQueues }>()
            router.batch('USER_QUEUE', 'create-user', collector.multi)

            const batch = createBatch('user-queue', [
                { action: 'create-user', userId: 'u1' },
                { action: 'create-user', userId: 'u2' },
            ])

            await router.queue(batch as any)

            expect(batch.messages[0].ack).toHaveBeenCalledOnce()
            expect(batch.messages[1].ack).toHaveBeenCalledOnce()
        })
    })

    describe('edge cases', () => {
        it('should handle empty batch', async () => {
            router = new QueueRouter<{ Queues: TestQueues }>()
            router.action('TEST_QUEUE', 'test-action', collector.single)

            const batch = createBatch('test-queue', [])

            await router.queue(batch as any)

            expect(collector.messages).toHaveLength(0)
        })

        it('should handle mixed single and batch handlers for different actions on same queue', async () => {
            type MixedQueue = {
                MY_QUEUE: Queue<
                    | { action: 'fast'; data: string }
                    | { action: 'slow'; id: number }
                >
            }

            const mixedRouter = new QueueRouter<{ Queues: MixedQueue }>()
            const singleHandler = vi.fn()
            const batchHandler = vi.fn()

            mixedRouter
                .action('MY_QUEUE', 'fast', singleHandler)
                .batch('MY_QUEUE', 'slow', batchHandler)

            const batch = createBatch('my-queue', [
                { action: 'fast', data: 'a' },
                { action: 'slow', id: 1 },
                { action: 'fast', data: 'b' },
                { action: 'slow', id: 2 },
            ])

            await mixedRouter.queue(batch as any)

            expect(singleHandler).toHaveBeenCalledTimes(2)
            expect(batchHandler).toHaveBeenCalledOnce()
            // All should be acked
            for (const msg of batch.messages) {
                expect(msg.ack).toHaveBeenCalledOnce()
            }
        })
    })

    // ============================================================
    // Type guard tests
    // ============================================================

    describe('isActionMessage', () => {
        it('should return true for valid action messages', () => {
            expect(isActionMessage({ action: 'test' })).toBe(true)
            expect(isActionMessage({ action: 'test', data: 123 })).toBe(true)
        })

        it('should return false for invalid values', () => {
            expect(isActionMessage(null)).toBe(false)
            expect(isActionMessage(undefined)).toBe(false)
            expect(isActionMessage(42)).toBe(false)
            expect(isActionMessage('string')).toBe(false)
            expect(isActionMessage({})).toBe(false)
            expect(isActionMessage({ action: 123 })).toBe(false)
            expect(isActionMessage({ action: '' })).toBe(false)
        })
    })
})
