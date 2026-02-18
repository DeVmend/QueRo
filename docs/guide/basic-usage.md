# Basic Usage

## Defining Handlers

Each handler consists of three parts:

1. **Type identifier** - The value that identifies this message type
2. **Schema** - A Valibot schema for validation and typing
3. **Handler function** - The async function that processes the message

```typescript
import { QueueRouter } from 'quero';
import * as v from 'valibot';

const router = new QueueRouter()
  .queue('my-queue', (q) => q
    .handle(
      'my-type',           // 1. Type identifier
      v.object({           // 2. Schema
        type: v.literal('my-type'),
        data: v.string()
      }),
      async (msg, env) => { // 3. Handler
        console.log(msg.data); // Fully typed!
      }
    )
  );
```

## Custom Type Field

By default, quero looks for a `type` field. You can customize this:

```typescript
const router = new QueueRouter({ typeField: 'event' })
  .queue('events', (q) => q
    .handle('user.signup', v.object({
      event: v.literal('user.signup'),  // Uses 'event' field
      userId: v.string()
    }), async (msg) => {
      // ...
    })
  );
```

## Handler Context

Handlers receive three arguments:

```typescript
.handle('my-type', schema, async (message, env, ctx) => {
  // message - The validated, typed message
  // env - Your worker's Env bindings
  // ctx - ExecutionContext (for waitUntil, etc.)
  
  ctx.waitUntil(logToAnalytics(message));
})
```

## Returning Values

Handlers can return values (useful for testing):

```typescript
.handle('calculate', schema, async (msg) => {
  const result = msg.a + msg.b;
  return { result };
})
```
