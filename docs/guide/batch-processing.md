# Batch Processing

Process multiple messages of the same action together for better efficiency.

## When to Use Batches

Use `.batch()` instead of `.action()` when:

- You can process multiple items in a single database query
- You want to reduce API calls by batching
- You need to aggregate data before processing

## Basic Usage

```typescript
import { QueueRouter } from 'quero'

type NewUser = { action: 'new-user'; userId: string; email: string }
type DeleteUser = { action: 'delete-user'; userId: string }
type UserMessage = NewUser | DeleteUser

type Queues = {
  USER_QUEUE: Queue<UserMessage>
}

const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  // Process all new-user messages together
  .batch('USER_QUEUE', 'new-user', async (messages, env) => {
    // messages is an array of all new-user messages in the batch
    console.log(`Processing ${messages.length} new users`)
    for (const msg of messages) {
      console.log(`- ${msg.email}`)
    }
  })
  // Process delete-user individually
  .action('USER_QUEUE', 'delete-user', async (msg, env) => {
    console.log(`Deleting user: ${msg.userId}`)
  })
```

## How It Works

1. Cloudflare delivers a batch of messages to your worker
2. quero groups messages by action
3. `.action()` handlers are called once per message
4. `.batch()` handlers are called once with all messages of that action

### Example Flow

If a batch contains:
- 3 `new-user` messages
- 2 `delete-user` messages

Then:
- `batch('new-user', ...)` is called once with array of 3 messages
- `action('delete-user', ...)` is called twice (once per message)

## Real-World Example

```typescript
const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  .batch('USER_QUEUE', 'new-user', async (messages, env) => {
    // Bulk insert all users at once
    const users = messages.map(msg => ({
      id: msg.userId,
      email: msg.email
    }))
    
    await env.DB.prepare(
      'INSERT INTO users (id, email) VALUES ' +
      users.map(() => '(?, ?)').join(', ')
    ).bind(...users.flatMap(u => [u.id, u.email])).run()
  })
```

## Error Handling

If a batch handler throws:
- All messages in that batch are retried
- Other actions in the same batch are not affected

```typescript
.batch('QUEUE', 'import', async (messages, env) => {
  // If this throws, all 'import' messages are retried
  await processImport(messages)
})
```

## Type Safety

Batch handlers receive a typed array:

```typescript
type NewUser = { action: 'new-user'; userId: string; email: string }

router.batch('USER_QUEUE', 'new-user', async (messages) => {
  // messages: { action: 'new-user'; userId: string; email: string }[]
  for (const msg of messages) {
    console.log(msg.userId, msg.email) // ✅ Fully typed
  }
})
```
