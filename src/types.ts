import type { Queue, ExecutionContext } from '@cloudflare/workers-types'

/**
 * Base bindings interface that can be extended by users
 */
export type Bindings = object

/**
 * Base variables interface that can be extended by users
 */
export type Variables = object

/**
 * Environment configuration interface
 */
export type Env = {
    Queues: Record<string, ActionQueue<ActionMessage>>
    Bindings?: Bindings
    Variables?: Variables
}

/**
 * Base action message interface - all messages must have an action property
 */
export type ActionMessage = Record<string, unknown> & { action: string }

/**
 * Queue type that handles action messages
 */
export type ActionQueue<T extends ActionMessage> = Queue<T>

/**
 * Utility type to extract action message types from a queue
 */
export type ActionsOfQueue<Q extends ActionQueue<ActionMessage>> =
    Q extends ActionQueue<infer T> ? T : never

/**
 * Union type of all message types across all queues in the environment
 */
export type AllMessageTypes<Queues extends Record<string, ActionQueue<ActionMessage>>> = {
    [K in keyof Queues]: ActionsOfQueue<Queues[K]>
}[keyof Queues]

/**
 * Configuration for a queue
 */
export type QueueConfig = {
    /** The name of the queue */
    name: string
}

/**
 * Handler configuration for processing messages
 */
export type Handler<T extends ActionMessage, E extends Env> =
    | {
          /** Handler for processing single messages */
          type: 'single'
          handle: (
              body: T,
              env?: E['Bindings'],
              executionCtx?: ExecutionContext
          ) => void | Promise<void>
      }
    | {
          /** Handler for processing multiple messages in batch */
          type: 'multi'
          handle: (
              bodies: T[],
              env?: E['Bindings'],
              executionCtx?: ExecutionContext
          ) => void | Promise<void>
      }

/**
 * Processing result for better error tracking
 */
export type ProcessingResult = {
    success: boolean
    error?: Error
    messagesProcessed: number
    handlersExecuted: number
}

/**
 * Queue processing options
 */
export type QueueProcessingOptions = {
    /** Enable detailed logging */
    enableLogging?: boolean
    /** Maximum number of retry attempts for failed messages */
    maxRetries?: number
    /** Whether to continue processing other messages if one fails */
    continueOnError?: boolean
}
