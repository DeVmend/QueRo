# Quick Start

Get up and running with quero in 5 minutes.

## 1. Install

```bash
npm install quero
```

## 2. Define Your Message Types

Every message needs an `action` field. Use a union type for multiple actions:

```typescript
type UserMessage = 
  | { action: 'created'; userId: string; email: string }
  | { action: 'deleted'; userId: string }
```

## 3. Define Your Queues

Map your Cloudflare queue bindings to their message types:

```typescript
type Queues = {
  USER_QUEUE: Queue<UserMessage>
}
```

## 4. Create the Router

```typescript
import { QueueRouter } from 'quero'

const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
```

## 5. Register Handlers

Use `.action()` to handle messages one at a time:

```typescript
router.action('USER_QUEUE', 'created', async (msg, env) => {
  // msg is typed as { action: 'created'; userId: string; email: string }
  console.log(`Welcome ${msg.email}!`)
})

router.action('USER_QUEUE', 'deleted', async (msg, env) => {
  // msg is typed as { action: 'deleted'; userId: string }
  console.log(`Goodbye ${msg.userId}`)
})
```

## 6. Wire Up Your Worker

```typescript
export default {
  async queue(batch, env) {
    await router.queue(batch, env)
  }
} satisfies ExportedHandler<Env>
```

## 7. Send Messages

```typescript
await env.USER_QUEUE.send({
  action: 'created',
  userId: '123',
  email: 'user@example.com'
})
```

## Complete Example

```typescript
import { QueueRouter } from 'quero'

// Message types
type UserMessage = 
  | { action: 'created'; userId: string; email: string }
  | { action: 'deleted'; userId: string }

// Queue bindings
type Queues = {
  USER_QUEUE: Queue<UserMessage>
}

// Router
const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  .action('USER_QUEUE', 'created', async (msg) => {
    console.log(`User created: ${msg.email}`)
  })
  .action('USER_QUEUE', 'deleted', async (msg) => {
    console.log(`User deleted: ${msg.userId}`)
  })

// Worker
export default {
  async fetch(req, env) {
    await env.USER_QUEUE.send({
      action: 'created',
      userId: '123',
      email: 'user@example.com'
    })
    return new Response('Message sent!')
  },

  async queue(batch, env) {
    await router.queue(batch, env)
  }
} satisfies ExportedHandler<Env>
```

## Next Steps

- [Single Queue](guide/single-queue.md) – Detailed single queue example
- [Multiple Queues](guide/multiple-queues.md) – Handle multiple queues
- [Batch Processing](guide/batch-processing.md) – Process messages in batches
