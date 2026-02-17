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

// Future: ProcessingResult and QueueProcessingOptions types
// will be added when advanced error handling is implemented
