# Single Queue

The simplest setup: one queue with multiple actions.

## Setup

### 1. Message Types

Define your messages as a union type. Each message must have an `action` field:

```typescript
type NewUser = { action: 'new-user'; userId: string; email: string }
type DeleteUser = { action: 'delete-user'; userId: string }
type UserMessage = NewUser | DeleteUser
```

### 2. Queue Type

Create a type that maps your binding name to the queue:

```typescript
type Queues = {
  USER_QUEUE: Queue<UserMessage>
}
```

### 3. Router

Create the router and register handlers:

```typescript
import { QueueRouter } from 'quero'

const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  .action('USER_QUEUE', 'new-user', async (msg, env) => {
    // msg.userId and msg.email are typed
    console.log(`Welcome ${msg.email}!`)
  })
  .action('USER_QUEUE', 'delete-user', async (msg, env) => {
    console.log(`Deleted user ${msg.userId}`)
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

```json
{
  "queues": {
    "producers": [
      {
        "binding": "USER_QUEUE",
        "queue": "user-queue"
      }
    ],
    "consumers": [
      {
        "queue": "user-queue",
        "max_batch_size": 10,
        "max_retries": 3
      }
    ]
  }
}
```

## Sending Messages

```typescript
// In your fetch handler or elsewhere
await env.USER_QUEUE.send({
  action: 'new-user',
  userId: 'user-123',
  email: 'user@example.com'
})

await env.USER_QUEUE.send({
  action: 'delete-user',
  userId: 'user-123'
})
```

## Type Safety

The router ensures full type safety:

```typescript
// ✅ Correct - TypeScript knows the shape
router.action('USER_QUEUE', 'new-user', async (msg) => {
  console.log(msg.email) // string
})

// ❌ Error - 'unknown-action' is not a valid action
router.action('USER_QUEUE', 'unknown-action', async (msg) => {})

// ❌ Error - email doesn't exist on 'delete-user'
router.action('USER_QUEUE', 'delete-user', async (msg) => {
  console.log(msg.email) // TypeScript error
})
```

## Complete Example

```typescript
import { QueueRouter } from 'quero'

// Message types
type NewUser = { action: 'new-user'; userId: string; email: string }
type DeleteUser = { action: 'delete-user'; userId: string }
type UserMessage = NewUser | DeleteUser

// Queue binding
type Queues = {
  USER_QUEUE: Queue<UserMessage>
}

// Router
const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  .action('USER_QUEUE', 'new-user', async (msg) => {
    console.log(`New user: ${msg.email}`)
  })
  .action('USER_QUEUE', 'delete-user', async (msg) => {
    console.log(`Deleted: ${msg.userId}`)
  })

// Worker
export default {
  async fetch(req, env) {
    await env.USER_QUEUE.send({
      action: 'new-user',
      userId: 'foo',
      email: 'foo@bar.com'
    })
    return new Response('Sent!')
  },
  async queue(batch, env) {
    await router.queue(batch, env)
  }
} satisfies ExportedHandler<Env>
```
