import type { ExecutionContext, MessageBatch } from '@cloudflare/workers-types'
import type {
    ActionMessage,
    ActionsOfQueue,
    AllMessageTypes,
    Env,
    Handler,
    QueueConfig,
    Bindings,
} from './types'

export class QueueRouter<E extends Env = Env> {
    private readonly handlers = new Map<string, Handler<ActionMessage, E>>()
    private readonly queueToBinding = new Map<string, string>()

    constructor(protected readonly queues?: Partial<Record<keyof E['Queues'], QueueConfig>>) {}

    private resolveQueueName(binding: keyof E['Queues'], env?: Bindings): string | undefined {
        const config = this.queues?.[binding]
        if (!config?.name) return undefined

        if (typeof config.name === 'function') {
            return config.name(env ?? {})
        }
        return config.name
    }

    private buildHandlerKey(binding: string, action: string): string {
        return `${binding}:${action}`
    }

    /**
     * Registers the mapping from queue name to binding
     * Called at runtime when we know the actual queue name
     */
    private registerQueueBinding(queueName: string, binding: string): void {
        if (!this.queueToBinding.has(queueName)) {
            this.queueToBinding.set(queueName, binding)
        }
    }

    private resolveBindingFromQueueName(queueName: string, env?: Bindings): string | undefined {
        const cached = this.queueToBinding.get(queueName)
        if (cached) return cached

        if (this.queues) {
            for (const [binding, config] of Object.entries(this.queues)) {
                if (!config?.name) continue
                
                const resolvedName = typeof config.name === 'function'
                    ? config.name(env ?? {})
                    : config.name

                if (resolvedName === queueName) {
                    this.queueToBinding.set(queueName, binding)
                    return binding
                }
            }
        }

        return undefined
    }

    protected addAction<
        Q extends keyof E['Queues'],
        T extends ActionsOfQueue<E['Queues'][Q]>,
        A extends T['action'],
    >(
        queue: Q,
        action: A,
        handler: (body: Extract<T, { action: A }>, Env: E['Bindings']) => void,
        multi: false
    ): this
    protected addAction<
        Q extends keyof E['Queues'],
        T extends ActionsOfQueue<E['Queues'][Q]>,
        A extends T['action'],
    >(
        queue: Q,
        action: A,
        handler: (bodies: Extract<T, { action: A }>[], Env: E['Bindings']) => void,
        multi: true
    ): this
    protected addAction<
        Q extends keyof E['Queues'],
        T extends ActionsOfQueue<E['Queues'][Q]>,
        A extends T['action'],
    >(
        queue: Q,
        action: A,
        handler:
            | ((body: Extract<T, { action: A }>) => void)
            | ((bodies: Extract<T, { action: A }>[]) => void),
        multi: boolean
    ) {
        // Use binding key, not queue name
        const key = this.buildHandlerKey(String(queue), action)
        const handlerConfig: Handler<ActionMessage, E> = multi
            ? { type: 'multi', handle: handler as (bodies: ActionMessage[]) => void }
            : { type: 'single', handle: handler as (body: ActionMessage) => void }

        this.handlers.set(key, handlerConfig)
        return this
    }

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
        return this.addAction(queue, action, handler, false)
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
        return this.addAction(queue, action, handler, true)
    }

    protected async processMessage(
        binding: string,
        message: { body: AllMessageTypes<E['Queues']> },
        messagesByAction: Map<string, AllMessageTypes<E['Queues']>[]>,
        env?: E['Bindings'],
        executionCtx?: ExecutionContext
    ): Promise<void> {
        const action = message.body.action
        const key = this.buildHandlerKey(binding, action)
        const handler = this.handlers.get(key)

        if (!handler) {
            console.warn(`No handler found for action: ${action} in binding: ${binding}`)
            return
        }

        if (handler.type === 'multi') {
            const messages = messagesByAction.get(key) ?? []
            messages.push(message.body)
            messagesByAction.set(key, messages)
        } else {
            await handler.handle(message.body, env, executionCtx)
        }
    }

    private async processMultiHandlers(
        messagesByAction: Map<string, AllMessageTypes<E['Queues']>[]>,
        env?: E['Bindings'],
        executionCtx?: ExecutionContext
    ): Promise<void> {
        for (const [key, bodies] of messagesByAction) {
            const handler = this.handlers.get(key)
            if (handler?.type === 'multi' && bodies.length > 0) {
                await handler.handle(bodies, env, executionCtx)
            }
        }
    }

    private findBindingForQueue(queueName: string, env?: Bindings): string | undefined {
        const cached = this.resolveBindingFromQueueName(queueName, env)
        if (cached) return cached

        for (const key of this.handlers.keys()) {
            const handlerBinding = key.split(':')[0]
            if (handlerBinding) {
                this.registerQueueBinding(queueName, handlerBinding)
                return handlerBinding
            }
        }

        return undefined
    }

    protected async processBatch(
        batch: MessageBatch<AllMessageTypes<E['Queues']>>,
        env?: E['Bindings'],
        executionCtx?: ExecutionContext
    ): Promise<void> {
        const queueName = batch.queue
        const binding = this.findBindingForQueue(queueName, env)
        
        if (!binding) {
            console.warn(`No binding found for queue: ${queueName}`)
            return
        }

        const messagesByAction = new Map<string, AllMessageTypes<E['Queues']>[]>()

        for (const message of batch.messages) {
            await this.processMessage(binding, message, messagesByAction, env, executionCtx)
            message.ack()
        }

        await this.processMultiHandlers(messagesByAction, env, executionCtx)
    }

    /**
     * Register a queue name to binding mapping explicitly
     * Useful when you know the queue name at startup
     */
    mapQueue(queueName: string, binding: keyof E['Queues']): this {
        this.queueToBinding.set(queueName, String(binding))
        return this
    }

    async queue(
        batch: MessageBatch<unknown>,
        env?: E['Bindings'] | object,
        executionCtx?: ExecutionContext
    ): Promise<void> {
        await this.processBatch(
            batch as MessageBatch<AllMessageTypes<E['Queues']>>,
            env as E['Bindings'],
            executionCtx
        )
    }
}
