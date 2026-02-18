# Multiple Queues

Handle multiple queues with a single router.

## Setup

### 1. Define Message Types for Each Queue

```typescript
// User queue messages
type NewUser = { action: 'new-user'; userId: string; email: string }
type DeleteUser = { action: 'delete-user'; userId: string }
type UserMessage = NewUser | DeleteUser

// Order queue messages
type PlaceOrder = { action: 'place-order'; orderId: string; amount: number }
type CancelOrder = { action: 'cancel-order'; orderId: string }
type OrderMessage = PlaceOrder | CancelOrder
```

### 2. Map Queue Bindings

```typescript
type Queues = {
  USER_QUEUE: Queue<UserMessage>
  ORDER_QUEUE: Queue<OrderMessage>
}
```

### 3. Create Router with Queue Config

When using multiple queues, you need to tell the router how to map queue names to bindings:

```typescript
import { QueueRouter } from 'quero'

const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>({
  USER_QUEUE: {
    name: 'user-queue-production'
  },
  ORDER_QUEUE: {
    name: 'order-queue-production'
  }
})
```

### 4. Register Handlers

```typescript
router
  .action('USER_QUEUE', 'new-user', async (msg, env) => {
    console.log(`New user: ${msg.email}`)
  })
  .action('USER_QUEUE', 'delete-user', async (msg, env) => {
    console.log(`Delete user: ${msg.userId}`)
  })
  .action('ORDER_QUEUE', 'place-order', async (msg, env) => {
    console.log(`Order placed: ${msg.orderId}`)
  })
  .action('ORDER_QUEUE', 'cancel-order', async (msg, env) => {
    console.log(`Order cancelled: ${msg.orderId}`)
  })
```

### 5. Export Worker

```typescript
export default {
  async queue(batch, env) {
    await router.queue(batch, env)
  }
} satisfies ExportedHandler<Env>
```

## Wrangler Configuration

```json
{
  "queues": {
    "producers": [
      {
        "binding": "USER_QUEUE",
        "queue": "user-queue-production"
      },
      {
        "binding": "ORDER_QUEUE",
        "queue": "order-queue-production"
      }
    ],
    "consumers": [
      { "queue": "user-queue-production" },
      { "queue": "order-queue-production" }
    ]
  }
}
```

## Dynamic Queue Names

Use a function to resolve queue names based on environment:

```typescript
const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>({
  USER_QUEUE: {
    name: (env) => `user-queue-${env.ENV_NAME}`
  },
  ORDER_QUEUE: {
    name: (env) => `order-queue-${env.ENV_NAME}`
  }
})
```

With wrangler environments:

```json
{
  "vars": {
    "ENV_NAME": "production"
  },
  "queues": {
    "producers": [
      { "binding": "USER_QUEUE", "queue": "user-queue-production" }
    ],
    "consumers": [
      { "queue": "user-queue-production" }
    ]
  },
  "env": {
    "staging": {
      "vars": {
        "ENV_NAME": "staging"
      },
      "queues": {
        "producers": [
          { "binding": "USER_QUEUE", "queue": "user-queue-staging" }
        ],
        "consumers": [
          { "queue": "user-queue-staging" }
        ]
      }
    }
  }
}
```

## Complete Example

```typescript
import { QueueRouter } from 'quero'

// Message types
type NewUser = { action: 'new-user'; userId: string; email: string }
type DeleteUser = { action: 'delete-user'; userId: string }
type UserMessage = NewUser | DeleteUser

type PlaceOrder = { action: 'place-order'; orderId: string; amount: number }
type OrderMessage = PlaceOrder

// Queue bindings
type Queues = {
  USER_QUEUE: Queue<UserMessage>
  ORDER_QUEUE: Queue<OrderMessage>
}

// Router with queue name mapping
const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>({
  USER_QUEUE: { name: (env) => `user-queue-${env.ENV_NAME}` },
  ORDER_QUEUE: { name: (env) => `order-queue-${env.ENV_NAME}` }
})
  .action('USER_QUEUE', 'new-user', async (msg) => {
    console.log(`Welcome ${msg.email}!`)
  })
  .action('USER_QUEUE', 'delete-user', async (msg) => {
    console.log(`Goodbye ${msg.userId}`)
  })
  .action('ORDER_QUEUE', 'place-order', async (msg) => {
    console.log(`Order ${msg.orderId}: $${msg.amount}`)
  })

export default {
  async fetch(req, env) {
    await env.USER_QUEUE.send({ action: 'new-user', userId: '1', email: 'a@b.com' })
    await env.ORDER_QUEUE.send({ action: 'place-order', orderId: 'x', amount: 99 })
    return new Response('Sent!')
  },
  async queue(batch, env) {
    await router.queue(batch, env)
  }
} satisfies ExportedHandler<Env>
```
