# Error Handling

How quero handles errors and retries.

## Automatic Ack/Retry

quero automatically manages message acknowledgment:

- **Success** → `message.ack()` is called
- **Error** → `message.retry()` is called

```typescript
router.action('QUEUE', 'task', async (msg) => {
  // If this throws, message is retried
  await riskyOperation(msg)
  // If successful, message is acknowledged
})
```

## Single Message Errors

When a `.action()` handler throws:

1. That specific message is retried
2. Other messages in the batch continue processing

```typescript
router.action('QUEUE', 'task', async (msg) => {
  if (msg.invalid) {
    throw new Error('Invalid message')
    // This message retries, others still process
  }
})
```

## Batch Handler Errors

When a `.batch()` handler throws:

1. **All messages** of that action are retried
2. Messages already processed by `.action()` handlers are acknowledged

```typescript
router.batch('QUEUE', 'import', async (messages) => {
  // If this throws, ALL import messages are retried
  await bulkImport(messages)
})
```

## Unhandled Actions

Messages with no registered handler:

- Are logged as warnings
- Are **not** retried (to prevent infinite loops)

```
[warn] No handler found for action: unknown-action in binding: QUEUE
```

## Unknown Queue Bindings

If quero can't map a queue name to a binding:

- All messages are retried
- A warning is logged

```
[warn] No binding found for queue: unknown-queue
```

## Wrangler Retry Configuration

Configure retries in `wrangler.jsonc`:

```json
{
  "queues": {
    "consumers": [
      {
        "queue": "my-queue",
        "max_retries": 3,
        "dead_letter_queue": "my-queue-dlq"
      }
    ]
  }
}
```

After `max_retries`, messages go to the dead letter queue.

## Best Practices

### Validate Early

```typescript
router.action('QUEUE', 'task', async (msg) => {
  // Validate first - fail fast
  if (!isValid(msg)) {
    console.error('Invalid message, not retrying')
    return // Don't throw - message is acked
  }
  
  await process(msg)
})
```

### Idempotent Handlers

Since messages can be retried, make handlers idempotent:

```typescript
router.action('QUEUE', 'create', async (msg, env) => {
  // Use upsert instead of insert
  await env.DB.prepare(
    'INSERT OR REPLACE INTO items (id, data) VALUES (?, ?)'
  ).bind(msg.id, msg.data).run()
})
```
