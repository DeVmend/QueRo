# QueueRouter

The main class for routing queue messages.

## Constructor

```typescript
new QueueRouter<E extends Env>(config?: Partial<Record<keyof E['Queues'], QueueConfig>>)
```

### Type Parameters

- `E` – Your environment type with `Bindings` and `Queues`

### Parameters

- `config` – Optional queue configuration for dynamic queue names

### Example

```typescript
// Basic
const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()

// With config
const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>({
  USER_QUEUE: {
    name: (env) => `user-queue-${env.ENVIRONMENT}`
  }
})
```

---

## Methods

### `.action()`

Register a handler for a single message.

```typescript
.action<Q, A>(
  queue: Q,
  action: A,
  handler: (msg, env, ctx) => void | Promise<void>
): this
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| `queue` | `keyof Queues` | The queue binding name |
| `action` | `string` | The action to handle |
| `handler` | `Function` | Handler function |

#### Handler Arguments

- `msg` – The message body (typed based on action)
- `env` – Your worker's environment bindings
- `ctx` – ExecutionContext (optional)

#### Example

```typescript
router.action('USER_QUEUE', 'created', async (msg, env) => {
  await env.DB.insert('users', { email: msg.email })
})
```

---

### `.batch()`

Register a handler for multiple messages of the same action.

```typescript
.batch<Q, A>(
  queue: Q,
  action: A,
  handler: (messages, env, ctx) => void | Promise<void>
): this
```

#### Parameters

Same as `.action()`, but handler receives an array.

#### Example

```typescript
router.batch('ANALYTICS', 'pageview', async (messages, env) => {
  await env.DB.insertBatch('pageviews', messages)
})
```

---

### `.mapQueue()`

Explicitly map a queue name to a binding.

```typescript
.mapQueue(queueName: string, binding: keyof Queues): this
```

#### Example

```typescript
router.mapQueue('user-queue-prod', 'USER_QUEUE')
```

---

### `.queue()`

Process a batch of messages.

```typescript
.queue(
  batch: MessageBatch,
  env?: Bindings,
  ctx?: ExecutionContext
): Promise<void>
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| `batch` | `MessageBatch` | The batch from Cloudflare |
| `env` | `Bindings` | Your environment bindings |
| `ctx` | `ExecutionContext` | Execution context |

#### Example

```typescript
export default {
  async queue(batch, env, ctx) {
    await router.queue(batch, env, ctx)
  }
}
```
