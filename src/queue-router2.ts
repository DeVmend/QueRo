import type { ExecutionContext, MessageBatch } from '@cloudflare/workers-types'
import type { ActionsOfQueue, Env } from './types'

export class QueueRouter2<E extends Env = Env> {
    constructor() {}

    action<
        Q extends keyof E['Queues'],
        T extends ActionsOfQueue<E['Queues'][Q]>,
        A extends T['action'],
    >(
        queue: Q,
        action: A,
        handler: (
            body: Extract<T, { action: A }>,
            Env: E['Bindings'],
            executionCtx?: ExecutionContext
        ) => void
    ) {
        console.log(queue, action, handler)
    }

    batch<
        Q extends keyof E['Queues'],
        T extends ActionsOfQueue<E['Queues'][Q]>,
        A extends T['action'],
    >(
        queue: Q,
        action: A,
        handler: (
            bodies: Extract<T, { action: A }>[],
            Env: E['Bindings'],
            executionCtx?: ExecutionContext
        ) => void
    ) {
        console.log(queue, action, handler)
    }

    async queue(
        batch: MessageBatch<unknown>,
        env?: E['Bindings'] | object,
        executionCtx?: ExecutionContext
    ): Promise<void> {
        console.log(batch, env, executionCtx)
    }
}
