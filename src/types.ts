import type { Queue, ExecutionContext } from '@cloudflare/workers-types'

export type Bindings = object

export type Variables = object

export type Env = {
    Queues: Record<string, ActionQueue<ActionMessage>>
    Bindings?: Bindings
    Variables?: Variables
}

export type ActionMessage = Record<string, unknown> & { action: string }

export type ActionQueue<T extends ActionMessage> = Queue<T>

export type ActionsOfQueue<Q extends ActionQueue<ActionMessage>> =
    Q extends ActionQueue<infer T extends ActionMessage> ? T : never

export type AllMessageTypes<Queues extends Record<string, ActionQueue<ActionMessage>>> = {
    [K in keyof Queues]: ActionsOfQueue<Queues[K]>
}[keyof Queues]

/**
 * Queue configuration - now optional
 * If name is not provided, routing is done by binding key
 */
export type QueueConfig<B = Bindings> = {
    name?: string | ((env: B) => string)
}

export type Handler<T extends ActionMessage, E extends Env> =
    | {
          type: 'single'
          handle: (
              body: T,
              env?: E['Bindings'],
              executionCtx?: ExecutionContext
          ) => void | Promise<void>
      }
    | {
          type: 'multi'
          handle: (
              bodies: T[],
              env?: E['Bindings'],
              executionCtx?: ExecutionContext
          ) => void | Promise<void>
      }

/**
 * Strategy for handling unmatched actions
 */
export type UnhandledStrategy = 'retry' | 'ack' | ((message: ActionMessage) => void | Promise<void>)

/**
 * Router configuration options
 */
export type QueueRouterOptions = {
    /** Strategy when no handler matches an action. Default: 'retry' */
    onUnhandled?: UnhandledStrategy
}

/**
 * Custom error classes for structured error handling
 */
export class QueueRouterError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'QueueRouterError'
    }
}

export class HandlerError extends QueueRouterError {
    public readonly action: string
    public readonly binding: string

    constructor(action: string, binding: string, cause?: unknown) {
        super(`Handler error for action "${action}" in binding "${binding}"`)
        this.name = 'HandlerError'
        this.action = action
        this.binding = binding
        this.cause = cause
    }
}

export class ValidationError extends QueueRouterError {
    constructor(message: string) {
        super(message)
        this.name = 'ValidationError'
    }
}

export class BindingResolutionError extends QueueRouterError {
    public readonly queueName: string

    constructor(queueName: string) {
        super(`No binding found for queue: ${queueName}`)
        this.name = 'BindingResolutionError'
        this.queueName = queueName
    }
}

/**
 * Type guard to validate that a value is a valid ActionMessage
 */
export function isActionMessage(value: unknown): value is ActionMessage {
    return (
        typeof value === 'object' &&
        value !== null &&
        'action' in value &&
        typeof (value as Record<string, unknown>).action === 'string' &&
        (value as Record<string, unknown>).action !== ''
    )
}
