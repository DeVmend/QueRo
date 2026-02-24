import type { ExecutionContext, MessageBatch } from '@cloudflare/workers-types'
import type {
    ActionMessage,
    ActionsOfQueue,
    AllMessageTypes,
    Env,
    Handler,
    QueueConfig,
    QueueRouterOptions,
    UnhandledStrategy,
} from './types'
import {
    isActionMessage,
    HandlerError,
    ValidationError,
    BindingResolutionError,
} from './types'

export class QueueRouter<E extends Env = Env> {
    private readonly handlers = new Map<string, Handler<ActionMessage, E>>()
    private readonly queueToBinding = new Map<string, string>()
    private readonly options: QueueRouterOptions

    constructor(
        protected readonly queues?: Partial<Record<keyof E['Queues'], QueueConfig<E['Bindings']>>>,
        options?: QueueRouterOptions
    ) {
        this.options = options ?? {}
    }

    private resolveQueueName(binding: keyof E['Queues'], env?: E['Bindings']): string | undefined {
        const config = this.queues?.[binding]
        if (!config?.name) return undefined

        if (typeof config.name === 'function') {
            if (!env) {
                throw new ValidationError(
                    `Queue "${String(binding)}" uses a dynamic name function but no env was provided`
                )
            }
            return config.name(env)
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

    private resolveBindingFromQueueName(
        queueName: string,
        env?: E['Bindings']
    ): string | undefined {
        const cached = this.queueToBinding.get(queueName)
        if (cached) return cached

        if (this.queues) {
            for (const [binding, config] of Object.entries(this.queues)) {
                if (!config?.name) continue

                const resolvedName =
                    typeof config.name === 'function'
                        ? config.name(env ?? ({} as E['Bindings']))
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
        T extends ActionsOfQueue<E['Queues'][Q]> & ActionMessage,
        A extends T['action'],
    >(
        queue: Q,
        action: A,
        handler: (body: Extract<T, { action: A }>, Env: E['Bindings']) => void,
        multi: false
    ): this
    protected addAction<
        Q extends keyof E['Queues'],
        T extends ActionsOfQueue<E['Queues'][Q]> & ActionMessage,
        A extends T['action'],
    >(
        queue: Q,
        action: A,
        handler: (bodies: Extract<T, { action: A }>[], Env: E['Bindings']) => void,
        multi: true
    ): this
    protected addAction<
        Q extends keyof E['Queues'],
        T extends ActionsOfQueue<E['Queues'][Q]> & ActionMessage,
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
        T extends ActionsOfQueue<E['Queues'][Q]> & ActionMessage,
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
        T extends ActionsOfQueue<E['Queues'][Q]> & ActionMessage,
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
    ): Promise<'handled' | 'batched' | 'unhandled'> {
        // Runtime validation: ensure message.body is a valid ActionMessage
        if (!isActionMessage(message.body)) {
            throw new ValidationError(
                `Invalid message body: missing or invalid "action" field. Got: ${JSON.stringify(message.body)}`
            )
        }

        const action = message.body.action
        const key = this.buildHandlerKey(binding, action)
        const handler = this.handlers.get(key)

        if (!handler) {
            return 'unhandled'
        }

        if (handler.type === 'multi') {
            const messages = messagesByAction.get(key) ?? []
            messages.push(message.body)
            messagesByAction.set(key, messages)
            return 'batched'
        } else {
            await handler.handle(message.body, env, executionCtx)
            return 'handled'
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

    private findBindingForQueue(queueName: string, env?: E['Bindings']): string | undefined {
        const cached = this.resolveBindingFromQueueName(queueName, env)
        if (cached) return cached

        // Get unique bindings from registered handlers
        const bindings = new Set<string>()
        for (const key of this.handlers.keys()) {
            const binding = key.split(':')[0]
            if (binding) bindings.add(binding)
        }

        // Only auto-map if there's exactly one binding registered
        if (bindings.size === 1) {
            const binding = bindings.values().next().value
            if (binding) {
                this.registerQueueBinding(queueName, binding)
                return binding
            }
        }

        // Multiple bindings: warn and require explicit mapping
        if (bindings.size > 1) {
            console.warn(
                `Multiple bindings registered (${[...bindings].join(', ')}). ` +
                    `Cannot auto-map queue "${queueName}". Use mapQueue() or provide queue config.`
            )
        }

        return undefined
    }

    /**
     * Handle an unhandled message based on the configured strategy
     */
    private async handleUnhandled(
        message: { body: AllMessageTypes<E['Queues']>; ack: () => void; retry: () => void },
    ): Promise<void> {
        const strategy = this.options.onUnhandled ?? 'retry'

        if (strategy === 'retry') {
            console.warn(`No handler found for action: "${(message.body as ActionMessage).action}". Retrying message.`)
            message.retry()
        } else if (strategy === 'ack') {
            console.warn(`No handler found for action: "${(message.body as ActionMessage).action}". Acknowledging message (will be lost).`)
            message.ack()
        } else {
            // Custom handler function
            await strategy(message.body as ActionMessage)
            message.ack()
        }
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
            // Retry all messages if no binding found
            for (const message of batch.messages) {
                message.retry()
            }
            return
        }

        const messagesByAction = new Map<string, AllMessageTypes<E['Queues']>[]>()
        // Track single-handled messages separately from batch-pending messages
        const singleHandledMessages: { ack: () => void; retry: () => void }[] = []
        const batchPendingMessages: { ack: () => void; retry: () => void }[] = []

        for (const message of batch.messages) {
            try {
                const result = await this.processMessage(binding, message, messagesByAction, env, executionCtx)

                if (result === 'handled') {
                    // Single handler succeeded — ack immediately, safe from batch failures
                    message.ack()
                    singleHandledMessages.push(message)
                } else if (result === 'batched') {
                    // Collected for batch processing — ack depends on batch handler success
                    batchPendingMessages.push(message)
                } else if (result === 'unhandled') {
                    await this.handleUnhandled(message)
                }
            } catch (error) {
                console.error(`Error processing message:`, error)
                message.retry()
            }
        }

        // Process batch handlers and ack only batch-pending messages after success
        if (batchPendingMessages.length > 0) {
            try {
                await this.processMultiHandlers(messagesByAction, env, executionCtx)
                for (const message of batchPendingMessages) {
                    message.ack()
                }
            } catch (error) {
                console.error(`Error in batch handler:`, error)
                // Only retry batch-pending messages, not already-acked single-handled ones
                for (const message of batchPendingMessages) {
                    message.retry()
                }
            }
        }
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
