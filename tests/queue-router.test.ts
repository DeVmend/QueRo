import { describe, it, expect, beforeEach } from 'vitest'
import { Queue } from '@cloudflare/workers-types'
import { QueueRouter } from '../src/queue-router'

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
            ack: () => {},
            retry: () => {},
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
})
