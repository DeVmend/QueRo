# Multiple Queues

quero supports routing multiple queues with a single router. Each queue can have its own set of handlers.

## Defining Multiple Queues

```typescript
import { QueueRouter } from 'quero';
import * as v from 'valibot';

const router = new QueueRouter()
  .queue('emails', (q) => q
    .handle('welcome', WelcomeSchema, handleWelcome)
    .handle('reset-password', ResetSchema, handleReset)
  )
  .queue('orders', (q) => q
    .handle('created', OrderCreatedSchema, handleOrderCreated)
    .handle('shipped', OrderShippedSchema, handleOrderShipped)
  )
  .queue('notifications', (q) => q
    .handle('push', PushSchema, handlePush)
    .handle('sms', SmsSchema, handleSms)
  );
```

## Queue Routing

quero uses the `batch.queue` property to determine which queue handlers to use:

```typescript
export default {
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext) {
    // batch.queue contains the queue name
    // quero automatically routes to the correct handlers
    await router.handle(batch, env, ctx);
  }
};
```

## Wrangler Configuration

Configure multiple queues in your `wrangler.toml`:

```toml
[[queues.consumers]]
queue = "emails"
max_batch_size = 10

[[queues.consumers]]
queue = "orders"
max_batch_size = 5

[[queues.consumers]]
queue = "notifications"
max_batch_size = 20
```

## Default Queue

If you only have one queue, you can use `"default"` as the queue name:

```typescript
const router = new QueueRouter()
  .queue('default', (q) => q
    .handle('task', TaskSchema, handleTask)
  );
```

## Queue-Specific Options

Each queue can have its own configuration (coming soon):

```typescript
// Future API
const router = new QueueRouter()
  .queue('critical', { retries: 5 }, (q) => q
    .handle('alert', AlertSchema, handleAlert)
  );
```
