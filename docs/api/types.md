# Types

TypeScript type definitions exported by quero.

## QueueRouterOptions

Configuration options for the QueueRouter.

```typescript
interface QueueRouterOptions {
  /**
   * The field name used to identify message types.
   * @default 'type'
   */
  typeField?: string;
}
```

## MessageHandler

The function signature for message handlers.

```typescript
type MessageHandler<S extends BaseSchema, Env> = (
  message: InferOutput<S>,
  env: Env,
  ctx: ExecutionContext
) => Promise<void> | void;
```

**Type Parameters:**
- `S` - The Valibot schema type
- `Env` - Your worker's environment type

**Arguments:**
- `message` - The validated message, typed according to schema
- `env` - Your worker's environment bindings
- `ctx` - Cloudflare's ExecutionContext

## QueueHandler

Internal type for registered handlers.

```typescript
interface QueueHandler<Env> {
  schema: BaseSchema;
  handler: MessageHandler<BaseSchema, Env>;
}
```

## Valibot Types

quero uses Valibot for schema validation. Common types you'll use:

```typescript
import * as v from 'valibot';

// Infer the output type from a schema
type User = v.InferOutput<typeof UserSchema>;

// Base schema type (for generic handlers)
type AnySchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;
```

## Cloudflare Types

These types come from `@cloudflare/workers-types`:

```typescript
// Message batch from a queue
interface MessageBatch<Body = unknown> {
  readonly queue: string;
  readonly messages: readonly Message<Body>[];
  ackAll(): void;
  retryAll(): void;
}

// Individual message
interface Message<Body = unknown> {
  readonly id: string;
  readonly timestamp: Date;
  readonly body: Body;
  ack(): void;
  retry(): void;
}

// Execution context
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
```

## Example: Full Typing

```typescript
import { QueueRouter } from 'quero';
import * as v from 'valibot';

// Define your environment
interface Env {
  DB: D1Database;
  QUEUE: Queue;
}

// Define schemas
const TaskSchema = v.object({
  type: v.literal('task'),
  taskId: v.string(),
  priority: v.picklist(['low', 'medium', 'high'])
});

type Task = v.InferOutput<typeof TaskSchema>;

// Create typed router
const router = new QueueRouter<Env>()
  .queue('tasks', (q) => q
    .handle('task', TaskSchema, async (msg, env) => {
      // msg: Task
      // env: Env
      await env.DB.exec(`INSERT INTO tasks VALUES ('${msg.taskId}')`);
    })
  );
```
