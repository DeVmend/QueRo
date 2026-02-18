# Multiple Queues

Handle multiple queues with a single router.

## Setup

### 1. Define Message Types for Each Queue

```typescript
// User queue messages
type UserMessage = 
  | { action: 'created'; userId: string; email: string }
  | { action: 'deleted'; userId: string }

// Email queue messages
type EmailMessage = 
  | { action: 'send'; to: string; subject: string; body: string }
  | { action: 'schedule'; to: string; subject: string; sendAt: string }
```

### 2. Map All Queues

```typescript
type Queues = {
  USER_QUEUE: Queue<UserMessage>
  EMAIL_QUEUE: Queue<EmailMessage>
}
```

### 3. Register Handlers

```typescript
import { QueueRouter } from 'quero'

const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  // User queue handlers
  .action('USER_QUEUE', 'created', async (msg, env) => {
    console.log(`User created: ${msg.email}`)
  })
  .action('USER_QUEUE', 'deleted', async (msg, env) => {
    console.log(`User deleted: ${msg.userId}`)
  })
  // Email queue handlers
  .action('EMAIL_QUEUE', 'send', async (msg, env) => {
    await sendEmail(msg.to, msg.subject, msg.body)
  })
  .action('EMAIL_QUEUE', 'schedule', async (msg, env) => {
    await scheduleEmail(msg.to, msg.subject, msg.sendAt)
  })
```

### 4. Single Worker Handler

The router automatically routes to the correct handlers based on the queue:

```typescript
export default {
  async queue(batch, env) {
    // Works for both USER_QUEUE and EMAIL_QUEUE
    await router.queue(batch, env)
  }
} satisfies ExportedHandler<Env>
```

## Wrangler Configuration

```toml
[[queues.producers]]
queue = "user-queue"
binding = "USER_QUEUE"

[[queues.producers]]
queue = "email-queue"
binding = "EMAIL_QUEUE"

[[queues.consumers]]
queue = "user-queue"
max_batch_size = 10

[[queues.consumers]]
queue = "email-queue"
max_batch_size = 50
```

## How Routing Works

When a batch arrives, quero:

1. Reads `batch.queue` to get the queue name
2. Maps it to the correct binding (e.g., `user-queue` → `USER_QUEUE`)
3. Routes to handlers registered for that binding

### Explicit Queue Mapping

If auto-mapping doesn't work, use `mapQueue()`:

```typescript
const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  .mapQueue('my-custom-queue-name', 'USER_QUEUE')
  .action('USER_QUEUE', 'created', async (msg) => {
    // ...
  })
```

## Sending to Different Queues

```typescript
// Send to user queue
await env.USER_QUEUE.send({
  action: 'created',
  userId: '123',
  email: 'user@example.com'
})

// Send to email queue
await env.EMAIL_QUEUE.send({
  action: 'send',
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Thanks for signing up.'
})
```
