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

type AnalyticsMessage = 
  | { action: 'pageview'; url: string; timestamp: number }
  | { action: 'click'; elementId: string; timestamp: number }

type Queues = {
  ANALYTICS_QUEUE: Queue<AnalyticsMessage>
}

const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  // Process all pageviews together
  .batch('ANALYTICS_QUEUE', 'pageview', async (messages, env) => {
    // messages is an array of all pageview messages in the batch
    const rows = messages.map(m => ({
      url: m.url,
      timestamp: m.timestamp
    }))
    await env.DB.insertBatch('pageviews', rows)
  })
  // Process clicks individually
  .action('ANALYTICS_QUEUE', 'click', async (msg, env) => {
    await env.DB.insert('clicks', {
      elementId: msg.elementId,
      timestamp: msg.timestamp
    })
  })
```

## How It Works

1. Cloudflare delivers a batch of messages to your worker
2. quero groups messages by action
3. `.action()` handlers are called once per message
4. `.batch()` handlers are called once with all messages of that action

### Example Flow

If a batch contains:
- 3 `pageview` messages
- 2 `click` messages

Then:
- `batch('pageview', ...)` is called once with array of 3 messages
- `action('click', ...)` is called twice (once per message)

## Mixing Action and Batch

You can mix both in the same router:

```typescript
const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  // Batch: efficient bulk insert
  .batch('EVENTS', 'log', async (messages, env) => {
    await bulkInsertLogs(messages)
  })
  // Action: needs individual processing
  .action('EVENTS', 'alert', async (msg, env) => {
    await sendAlert(msg)
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
type OrderMessage = 
  | { action: 'placed'; orderId: string; items: string[] }
  | { action: 'cancelled'; orderId: string; reason: string }

router.batch('ORDER_QUEUE', 'placed', async (messages) => {
  // messages: { action: 'placed'; orderId: string; items: string[] }[]
  for (const msg of messages) {
    console.log(msg.orderId, msg.items) // ✅ Fully typed
  }
})
```
