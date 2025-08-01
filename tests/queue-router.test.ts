import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Queue } from '@cloudflare/workers-types'
import { QueueRouter } from '../src/queue-router'

type TestQueues = {
    TEST_QUEUE: Queue<{ action: 'test-action'; data: string }>
    USER_QUEUE: Queue<{ action: 'create-user'; userId: string }>
    NOTIFICATION_QUEUE: Queue<{ action: 'send-notification'; userId: string }>
}

describe('QueueRouter', () => {
    let queueRouter: QueueRouter<{ Queues: TestQueues }>
    let consoleSpy: any

    beforeEach(() => {
        queueRouter = new QueueRouter<{ Queues: TestQueues }>({
            TEST_QUEUE: { name: 'test-queue' },
            USER_QUEUE: { name: 'user-queue' },
            NOTIFICATION_QUEUE: { name: 'notification-queue' },
        })

        // Mock console methods for testing
        consoleSpy = {
            warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
            error: vi.spyOn(console, 'error').mockImplementation(() => {}),
        }
    })

    describe('constructor', () => {
        it('should initialize with queue configurations', () => {
            expect(queueRouter).toBeDefined()
            expect(queueRouter['queues']).toEqual({
                TEST_QUEUE: { name: 'test-queue' },
                USER_QUEUE: { name: 'user-queue' },
                NOTIFICATION_QUEUE: { name: 'notification-queue' },
            })
        })
    })

    describe('single message handlers', () => {
        it('should register and execute single message handler', async () => {
            const handler = vi.fn()

            queueRouter.action('TEST_QUEUE', 'test-action', handler)

            const batch = {
                queue: 'test-queue',
                messages: [{ body: { action: 'test-action', data: 'test-data' }, ack: () => {} }],
            }

            await queueRouter['processBatch'](batch as any)

            expect(handler).toHaveBeenCalledWith(
                { action: 'test-action', data: 'test-data' },
                undefined,
                undefined
            )
        })
    })

    describe('multi message handlers', () => {
        it('should register and execute multi message handler with batched messages', async () => {
            const handler = vi.fn()

            queueRouter.batch('USER_QUEUE', 'create-user', handler)

            const batch = {
                queue: 'user-queue',
                messages: [
                    { body: { action: 'create-user', userId: 'user1' }, ack: () => {} },
                    { body: { action: 'create-user', userId: 'user2' }, ack: () => {} },
                ],
            }

            await queueRouter['processBatch'](batch as any)

            expect(handler).toHaveBeenCalledWith(
                [
                    { action: 'create-user', userId: 'user1' },
                    { action: 'create-user', userId: 'user2' },
                ],
                undefined,
                undefined
            )
        })
    })

    describe('error handling', () => {
        it('should warn when no handler is found', async () => {
            const batch = {
                queue: 'test-queue',
                messages: [{ body: { action: 'unknown-action', data: 'test' }, ack: () => {} }],
            }

            await queueRouter['processBatch'](batch as any)

            expect(consoleSpy.warn).toHaveBeenCalledWith(
                'No handler found for action: unknown-action in queue: test-queue'
            )
        })
    })

    describe('ack', () => {
        it('should ack messages', async () => {
            const batch = {
                queue: 'test-queue',
                messages: [{ body: { action: 'test-action', data: 'test' }, ack: vi.fn() }],
            }

            await queueRouter['processBatch'](batch as any)

            expect(batch.messages[0].ack).toHaveBeenCalled()
        })
    })

    describe('queue method', () => {
        it('should process batch through main queue entry point', async () => {
            const handler = vi.fn()
            queueRouter.batch('TEST_QUEUE', 'test-action', handler)

            const batch = {
                queue: 'test-queue',
                messages: [{ body: { action: 'test-action', data: 'test' }, ack: () => {} }],
            } as any

            await queueRouter.queue(batch, {}, {} as any)

            expect(handler).toHaveBeenCalled()
        })
    })
})
