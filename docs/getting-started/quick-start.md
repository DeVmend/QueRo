# Quick Start

This guide will get you up and running with quero in under 5 minutes.

## 1. Create the Router

```typescript
// src/queue-handler.ts
import { QueueRouter } from 'quero';
import * as v from 'valibot';

// Define your message schemas
const UserCreatedSchema = v.object({
  type: v.literal('user.created'),
  userId: v.string(),
  email: v.string()
});

const OrderPlacedSchema = v.object({
  type: v.literal('order.placed'),
  orderId: v.string(),
  amount: v.number()
});

// Create the router
export const queueRouter = new QueueRouter()
  .queue('events', (q) => q
    .handle('user.created', UserCreatedSchema, async (msg, env) => {
      console.log(`Welcome email to ${msg.email}`);
      // Send welcome email...
    })
    .handle('order.placed', OrderPlacedSchema, async (msg, env) => {
      console.log(`Processing order ${msg.orderId}`);
      // Process order...
    })
  );
```

## 2. Wire Up Your Worker

```typescript
// src/index.ts
import { queueRouter } from './queue-handler';

export interface Env {
  EVENTS_QUEUE: Queue;
}

export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    await queueRouter.handle(batch, env, ctx);
  }
};
```

## 3. Send Messages

```typescript
// Anywhere in your worker
await env.EVENTS_QUEUE.send({
  type: 'user.created',
  userId: '123',
  email: 'user@example.com'
});

await env.EVENTS_QUEUE.send({
  type: 'order.placed', 
  orderId: 'order-456',
  amount: 99.99
});
```

## How It Works

1. **Messages arrive** in a batch from your Cloudflare Queue
2. **quero inspects** each message's `type` field (configurable)
3. **Validates** the message against the registered schema
4. **Routes** to the matching handler with full type safety
5. **Acknowledges** or retries based on handler success

## Next Steps

- Learn about [Multiple Queues](guide/multiple-queues.md)
- Handle errors with [Error Handling](guide/error-handling.md)
- Dive into the [API Reference](api/queue-router.md)
