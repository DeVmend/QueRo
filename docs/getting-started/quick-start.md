# Quick Start

Get up and running with quero in 5 minutes.

## 1. Install

```bash
npm install quero
```

## 2. Define Message Types

Every message needs an `action` field:

```typescript
type NewUser = { action: 'new-user'; userId: string; email: string }
type DeleteUser = { action: 'delete-user'; userId: string }
type UserMessage = NewUser | DeleteUser
```

## 3. Define Queue Bindings

Map your Cloudflare queue bindings to message types:

```typescript
type Queues = {
  USER_QUEUE: Queue<UserMessage>
}
```

## 4. Create Router & Register Handlers

```typescript
import { QueueRouter } from 'quero'

const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  .action('USER_QUEUE', 'new-user', async (msg, env) => {
    console.log(`Welcome ${msg.email}!`)
  })
  .action('USER_QUEUE', 'delete-user', async (msg, env) => {
    console.log(`Goodbye ${msg.userId}`)
  })
```

## 5. Export Worker

```typescript
export default {
  async queue(batch, env) {
    await router.queue(batch, env)
  }
} satisfies ExportedHandler<Env>
```

## 6. Configure Wrangler

```json
{
  "queues": {
    "producers": [{ "binding": "USER_QUEUE", "queue": "user-queue" }],
    "consumers": [{ "queue": "user-queue" }]
  }
}
```

## 7. Send Messages

```typescript
await env.USER_QUEUE.send({
  action: 'new-user',
  userId: '123',
  email: 'user@example.com'
})
```

## Next Steps

- [Multiple Queues](guide/multiple-queues.md) – Handle multiple queues
- [Batch Processing](guide/batch-processing.md) – Process messages in batches
- [Error Handling](guide/error-handling.md) – Retries and dead letter queues
