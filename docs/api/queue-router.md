# QueueRouter

The main class for creating and managing queue message routing.

## Constructor

```typescript
new QueueRouter<Env>(options?: QueueRouterOptions)
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `typeField` | `string` | `'type'` | The field name used to identify message types |

### Example

```typescript
import { QueueRouter } from 'quero';

// Default options
const router = new QueueRouter();

// Custom type field
const router = new QueueRouter({ typeField: 'event' });

// With typed Env
const router = new QueueRouter<MyEnv>();
```

## Methods

### `.queue(name, builder)`

Register handlers for a specific queue.

```typescript
router.queue(name: string, builder: (q: QueueBuilder) => QueueBuilder): QueueRouter
```

**Parameters:**
- `name` - The queue name (matches `batch.queue`)
- `builder` - A function that receives a `QueueBuilder` and returns it with handlers

**Returns:** `QueueRouter` (for chaining)

**Example:**

```typescript
router
  .queue('emails', (q) => q
    .handle('welcome', WelcomeSchema, handleWelcome)
  )
  .queue('orders', (q) => q
    .handle('created', OrderSchema, handleOrder)
  );
```

---

### `.handle(batch, env, ctx)`

Process a batch of queue messages.

```typescript
router.handle(
  batch: MessageBatch,
  env: Env,
  ctx: ExecutionContext
): Promise<void>
```

**Parameters:**
- `batch` - The MessageBatch from Cloudflare
- `env` - Your worker's environment bindings
- `ctx` - The ExecutionContext

**Example:**

```typescript
export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    await router.handle(batch, env, ctx);
  }
};
```

---

## QueueBuilder

The builder object passed to `.queue()`.

### `.handle(type, schema, handler)`

Register a handler for a specific message type.

```typescript
q.handle<S extends BaseSchema>(
  type: string,
  schema: S,
  handler: MessageHandler<S, Env>
): QueueBuilder
```

**Parameters:**
- `type` - The message type identifier
- `schema` - A Valibot schema for validation
- `handler` - Async function to process the message

**Returns:** `QueueBuilder` (for chaining)

**Example:**

```typescript
q.handle('user.created', 
  v.object({
    type: v.literal('user.created'),
    userId: v.string(),
  }),
  async (msg, env, ctx) => {
    await env.DB.insert('users', { id: msg.userId });
  }
)
```
