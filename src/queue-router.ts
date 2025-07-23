import type { ExecutionContext, MessageBatch } from '@cloudflare/workers-types'
import type {
    ActionMessage,
    ActionsOfQueue,
    AllMessageTypes,
    Env,
    Handler,
    QueueConfig,
} from './types'

/**
 * A robust queue router that handles message processing for Cloudflare Queues
 * with support for both single and batch message processing.
 *
 * @template E - Environment type extending Env
 */
export class QueueRouter<E extends Env = Env> {
    private readonly handlers = new Map<string, Handler<ActionMessage, E>>()

    constructor(protected readonly queues: Record<keyof E['Queues'], QueueConfig>) {}

    /**
     * Gets the configuration for a specific queue binding
     * @param binding - The queue binding key
     * @returns The queue configuration
     * @throws Error if queue is not found
     */
    protected getQueueConfig(binding: keyof E['Queues']): QueueConfig {
        const queue = this.queues[binding]
        if (!queue) {
            throw new Error(`Queue ${String(binding)} not found`)
        }
        return queue
    }

    /**
     * Gets the name of a queue from its binding
     * @param binding - The queue binding key
     * @returns The queue name
     */
    protected getQueueName(binding: keyof E['Queues']): string {
        return this.getQueueConfig(binding).name
    }

    /**
     * Internal method to add action handlers
     */
    protected addAction<
        Q extends keyof E['Queues'],
        T extends ActionsOfQueue<E['Queues'][Q]>,
        A extends T['action'],
    >(queue: Q, action: A, handler: (body: Extract<T, { action: A }>) => void, multi: false): this
    protected addAction<
        Q extends keyof E['Queues'],
        T extends ActionsOfQueue<E['Queues'][Q]>,
        A extends T['action'],
    >(
        queue: Q,
        action: A,
        handler: (bodies: Extract<T, { action: A }>[]) => void,
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
        const key = this.buildHandlerKey(this.getQueueName(queue), action)
        const handlerConfig: Handler<ActionMessage, E> = multi
            ? {
                  type: 'multi',
                  handle: handler as (bodies: ActionMessage[]) => void,
              }
            : {
                  type: 'single',
                  handle: handler as (body: ActionMessage) => void,
              }

        this.handlers.set(key, handlerConfig)
        return this
    }

    /**
     * Registers a handler for processing single messages
     * @param queue - The queue binding
     * @param action - The action type to handle
     * @param handler - The handler function for single messages
     */
    singleMessageAction<
        Q extends keyof E['Queues'],
        T extends ActionsOfQueue<E['Queues'][Q]>,
        A extends T['action'],
    >(
        queue: Q,
        action: A,
        handler: (
            body: Extract<T, { action: A }>,
            Env?: E['Bindings'],
            executionCtx?: ExecutionContext
        ) => void
    ) {
        return this.addAction(queue, action, handler, false)
    }

    /**
     * Registers a handler for processing multiple messages in batch
     * @param queue - The queue binding
     * @param action - The action type to handle
     * @param handler - The handler function for message batches
     */
    action<
        Q extends keyof E['Queues'],
        T extends ActionsOfQueue<E['Queues'][Q]>,
        A extends T['action'],
    >(
        queue: Q,
        action: A,
        handler: (
            bodies: Extract<T, { action: A }>[],
            Env?: E['Bindings'],
            executionCtx?: ExecutionContext
        ) => void
    ) {
        return this.addAction(queue, action, handler, true)
    }

    /**
     * Builds a unique key for handler registration
     * @param queueName - The queue name
     * @param action - The action type
     * @returns Unique handler key
     */
    private buildHandlerKey(queueName: string, action: string): string {
        return `${queueName}:${action}`
    }

    /**
     * Processes a single message, either immediately or adds it to batch collection
     * @param queueName - The name of the queue
     * @param message - The message to process
     * @param messagesByAction - Map to collect messages for batch processing
     * @param env - Environment bindings
     * @param executionCtx - Execution context
     */
    private async processMessage(
        queueName: string,
        message: { body: AllMessageTypes<E['Queues']> },
        messagesByAction: Map<string, AllMessageTypes<E['Queues']>[]>,
        env?: E['Bindings'],
        executionCtx?: ExecutionContext
    ): Promise<void> {
        try {
            const action = message.body.action
            const key = this.buildHandlerKey(queueName, action)
            const handler = this.handlers.get(key)

            if (!handler) {
                console.warn(`No handler found for action: ${action} in queue: ${queueName}`)
                return
            }

            if (handler.type === 'multi') {
                this.collectMessageForBatch(key, message.body, messagesByAction)
            } else {
                await this.executeSingleHandler(handler, message.body, env, executionCtx)
            }
        } catch (error) {
            console.error(`Error processing message in queue ${queueName}:`, error)
            throw error
        }
    }

    /**
     * Executes a single message handler with error handling
     * @param handler - The handler to execute
     * @param body - The message body
     * @param env - Environment bindings
     * @param executionCtx - Execution context
     */
    private async executeSingleHandler(
        handler: Extract<Handler<ActionMessage, E>, { type: 'single' }>,
        body: AllMessageTypes<E['Queues']>,
        env?: E['Bindings'],
        executionCtx?: ExecutionContext
    ): Promise<void> {
        try {
            await handler.handle(body, env, executionCtx)
        } catch (error) {
            console.error('Error in single message handler:', error)
            throw error // Re-throw to allow queue retry mechanism
        }
    }

    /**
     * Collects messages for batch processing
     * @param key - The handler key
     * @param body - The message body
     * @param messagesByAction - Map to store messages by action
     */
    private collectMessageForBatch(
        key: string,
        body: AllMessageTypes<E['Queues']>,
        messagesByAction: Map<string, AllMessageTypes<E['Queues']>[]>
    ): void {
        const messages = messagesByAction.get(key)
        if (messages) {
            messages.push(body)
        } else {
            messagesByAction.set(key, [body])
        }
    }

    /**
     * Processes all collected multi-handlers with their batched messages
     * @param messagesByAction - Map of messages grouped by action
     * @param env - Environment bindings
     * @param executionCtx - Execution context
     */
    private async processMultiHandlers(
        messagesByAction: Map<string, AllMessageTypes<E['Queues']>[]>,
        env?: E['Bindings'],
        executionCtx?: ExecutionContext
    ): Promise<void> {
        for (const [key, bodies] of messagesByAction) {
            try {
                const handler = this.handlers.get(key)
                if (!handler) {
                    console.warn(`Handler not found for key: ${key}`)
                    continue
                }

                if (handler.type === 'multi' && bodies.length > 0) {
                    await handler.handle(bodies, env, executionCtx)
                }
            } catch (error) {
                console.error(`Error in multi message handler for key ${key}:`, error)
                throw error // Re-throw to allow queue retry mechanism
            }
        }
    }

    /**
     * Processes a batch of messages from a queue
     * @param batch - The message batch to process
     * @param env - Environment bindings
     * @param executionCtx - Execution context
     */
    async processBatch(
        batch: MessageBatch<AllMessageTypes<E['Queues']>>,
        env?: E['Bindings'],
        executionCtx?: ExecutionContext
    ): Promise<void> {
        const queueName = batch.queue
        const messagesByAction = new Map<string, AllMessageTypes<E['Queues']>[]>()

        // Process all individual messages
        for (const message of batch.messages) {
            await this.processMessage(queueName, message, messagesByAction, env, executionCtx)
        }

        // Process all collected multi-handlers
        await this.processMultiHandlers(messagesByAction, env, executionCtx)
    }

    /**
     * Main entry point for queue message processing
     * @param batch - The message batch
     * @param env - Environment bindings or object
     * @param executionCtx - Execution context
     */
    async queue(
        batch: MessageBatch<unknown>,
        env?: E['Bindings'] | object,
        executionCtx?: ExecutionContext
    ): Promise<void> {
        try {
            await this.processBatch(
                batch as MessageBatch<AllMessageTypes<E['Queues']>>,
                env,
                executionCtx
            )
        } catch (error) {
            console.error('Fatal error processing queue batch:', error)
            throw error // Re-throw to allow queue retry mechanism
        }
    }
}
