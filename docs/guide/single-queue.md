# Single Queue

The simplest setup: one queue with multiple actions.

## Setup

### 1. Message Types

Define your messages as a union type. Each message must have an `action` field:

```typescript
type OrderMessage = 
  | { action: 'placed'; orderId: string; amount: number }
  | { action: 'shipped'; orderId: string; trackingNumber: string }
  | { action: 'delivered'; orderId: string }
```

### 2. Queue Type

Create a type that maps your binding name to the queue:

```typescript
type Queues = {
  ORDER_QUEUE: Queue<OrderMessage>
}
```

### 3. Router

Create the router and register handlers:

```typescript
import { QueueRouter } from 'quero'

const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  .action('ORDER_QUEUE', 'placed', async (msg, env) => {
    // msg.orderId and msg.amount are typed
    await env.DB.insert({ id: msg.orderId, amount: msg.amount })
  })
  .action('ORDER_QUEUE', 'shipped', async (msg, env) => {
    // msg.trackingNumber is available here
    await sendTrackingEmail(msg.orderId, msg.trackingNumber)
  })
  .action('ORDER_QUEUE', 'delivered', async (msg, env) => {
    await markAsDelivered(msg.orderId)
  })
```

### 4. Worker Export

```typescript
export default {
  async queue(batch, env) {
    await router.queue(batch, env)
  }
} satisfies ExportedHandler<Env>
```

## Wrangler Configuration

```toml
[[queues.producers]]
queue = "order-queue"
binding = "ORDER_QUEUE"

[[queues.consumers]]
queue = "order-queue"
max_batch_size = 10
max_retries = 3
```

## Sending Messages

```typescript
// In your fetch handler or elsewhere
await env.ORDER_QUEUE.send({
  action: 'placed',
  orderId: 'order-123',
  amount: 99.99
})

await env.ORDER_QUEUE.send({
  action: 'shipped',
  orderId: 'order-123',
  trackingNumber: '1Z999AA10123456784'
})
```

## Type Safety

The router ensures full type safety:

```typescript
// ✅ Correct - TypeScript knows the shape
router.action('ORDER_QUEUE', 'placed', async (msg) => {
  console.log(msg.amount) // number
})

// ❌ Error - 'cancelled' is not a valid action
router.action('ORDER_QUEUE', 'cancelled', async (msg) => {})

// ❌ Error - trackingNumber doesn't exist on 'placed'
router.action('ORDER_QUEUE', 'placed', async (msg) => {
  console.log(msg.trackingNumber) // TypeScript error
})
```
