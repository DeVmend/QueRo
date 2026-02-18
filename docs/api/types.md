# Types

TypeScript types used by quero.

## Env

The environment type expected by QueueRouter.

```typescript
type Env = {
  Queues: Record<string, Queue<ActionMessage>>
  Bindings?: object
  Variables?: object
}
```

### Usage

```typescript
// Your worker's Env (from wrangler)
interface Env {
  DB: D1Database
  USER_QUEUE: Queue
  ENVIRONMENT: string
}

// Your message types
type UserMessage = { action: 'created'; userId: string }

// Your queues type
type Queues = {
  USER_QUEUE: Queue<UserMessage>
}

// Combined for QueueRouter
type RouterEnv = {
  Bindings: Env
  Queues: Queues
}

const router = new QueueRouter<RouterEnv>()
```

---

## ActionMessage

All messages must have an `action` field.

```typescript
type ActionMessage = Record<string, unknown> & { action: string }
```

### Example

```typescript
// ✅ Valid
type MyMessage = { action: 'foo'; data: string }

// ❌ Invalid - missing action
type BadMessage = { type: 'foo'; data: string }
```

---

## QueueConfig

Configuration for a queue binding.

```typescript
type QueueConfig<B = object> = {
  name?: string | ((env: B) => string)
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string \| ((env) => string)` | Queue name or resolver function |

### Example

```typescript
const router = new QueueRouter<RouterEnv>({
  USER_QUEUE: {
    name: 'user-queue'
  },
  EVENTS_QUEUE: {
    name: (env) => `events-${env.ENVIRONMENT}`
  }
})
```

---

## Utility Types

### ActionsOfQueue

Extract message types from a queue.

```typescript
type ActionsOfQueue<Q extends Queue<ActionMessage>> = 
  Q extends Queue<infer T> ? T : never
```

### AllMessageTypes

Get all message types from all queues.

```typescript
type AllMessageTypes<Queues> = {
  [K in keyof Queues]: ActionsOfQueue<Queues[K]>
}[keyof Queues]
```

---

## Complete Example

```typescript
import { QueueRouter } from 'quero'

// Cloudflare bindings (from worker-configuration.d.ts)
interface Env {
  DB: D1Database
  USER_QUEUE: Queue
  ORDER_QUEUE: Queue
}

// Message types
type UserMessage = 
  | { action: 'created'; userId: string; email: string }
  | { action: 'deleted'; userId: string }

type OrderMessage = 
  | { action: 'placed'; orderId: string }
  | { action: 'shipped'; orderId: string }

// Queue mapping
type Queues = {
  USER_QUEUE: Queue<UserMessage>
  ORDER_QUEUE: Queue<OrderMessage>
}

// Router type
type RouterEnv = {
  Bindings: Env
  Queues: Queues
}

// Create router with full type safety
const router = new QueueRouter<RouterEnv>()
  .action('USER_QUEUE', 'created', async (msg, env) => {
    // msg: { action: 'created'; userId: string; email: string }
    // env: Env
  })
```
