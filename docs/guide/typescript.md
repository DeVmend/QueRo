# TypeScript

quero is built with TypeScript and provides excellent type inference.

## Automatic Type Inference

Message types are automatically inferred from your Valibot schemas:

```typescript
const UserSchema = v.object({
  type: v.literal('user.created'),
  id: v.string(),
  email: v.string(),
  createdAt: v.pipe(v.string(), v.isoTimestamp())
});

router.handle('user.created', UserSchema, async (msg) => {
  // msg is fully typed:
  // {
  //   type: 'user.created',
  //   id: string,
  //   email: string,
  //   createdAt: string
  // }
  console.log(msg.email); // ✅ TypeScript knows this is a string
  console.log(msg.foo);   // ❌ TypeScript error: Property 'foo' does not exist
});
```

## Typed Environment

Pass your Env type for typed environment access:

```typescript
interface Env {
  DATABASE: D1Database;
  CACHE: KVNamespace;
  API_KEY: string;
}

const router = new QueueRouter<Env>()
  .queue('tasks', (q) => q
    .handle('sync', SyncSchema, async (msg, env) => {
      // env is typed as Env
      const db = env.DATABASE;  // ✅ D1Database
      const key = env.API_KEY;  // ✅ string
    })
  );
```

## Schema Reuse

Define schemas once, reuse everywhere:

```typescript
// schemas/user.ts
export const UserCreatedSchema = v.object({
  type: v.literal('user.created'),
  userId: v.string(),
  email: v.pipe(v.string(), v.email())
});

export type UserCreated = v.InferOutput<typeof UserCreatedSchema>;

// queue-handler.ts
import { UserCreatedSchema, UserCreated } from './schemas/user';

router.handle('user.created', UserCreatedSchema, async (msg: UserCreated) => {
  // Explicit typing also works
});
```

## Extracting Handler Types

Get the message type for a specific handler:

```typescript
import type { InferOutput } from 'valibot';

const OrderSchema = v.object({
  type: v.literal('order'),
  items: v.array(v.object({
    sku: v.string(),
    quantity: v.number()
  }))
});

type Order = InferOutput<typeof OrderSchema>;
// {
//   type: 'order',
//   items: { sku: string, quantity: number }[]
// }
```

## Strict Mode

Enable TypeScript strict mode for the best experience:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```
