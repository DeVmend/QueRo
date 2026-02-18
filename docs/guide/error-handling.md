# Error Handling

quero provides robust error handling for queue message processing.

## Automatic Retries

When a handler throws an error, the message is automatically retried according to your Cloudflare Queue settings:

```typescript
.handle('risky-task', schema, async (msg) => {
  const result = await externalApi.call(msg);
  if (!result.ok) {
    throw new Error('API call failed'); // Will be retried
  }
})
```

Configure retries in `wrangler.toml`:

```toml
[[queues.consumers]]
queue = "tasks"
max_retries = 3
dead_letter_queue = "tasks-dlq"
```

## Validation Errors

If a message fails schema validation, quero throws a descriptive error:

```typescript
// Message: { type: 'user', name: 123 }
// Schema expects: { type: 'user', name: string }

// Error: "Invalid message body: expected string, got number at 'name'"
```

## Unknown Message Types

Messages with unregistered types are logged and acknowledged to prevent infinite retries:

```typescript
// Message: { type: 'unknown-type', data: '...' }
// Logs: "No handler registered for type: unknown-type"
// Message is acknowledged (not retried)
```

## Custom Error Handling

Wrap your handler logic for custom error handling:

```typescript
.handle('task', schema, async (msg, env) => {
  try {
    await processTask(msg);
  } catch (error) {
    if (error instanceof ValidationError) {
      // Don't retry validation errors
      console.error('Invalid task data:', error);
      return;
    }
    // Re-throw to trigger retry
    throw error;
  }
})
```

## Dead Letter Queues

Configure a DLQ for messages that fail all retries:

```toml
[[queues.consumers]]
queue = "tasks"
max_retries = 3
dead_letter_queue = "tasks-dlq"

[[queues.consumers]]
queue = "tasks-dlq"
max_batch_size = 1
```

Then handle DLQ messages separately:

```typescript
const router = new QueueRouter()
  .queue('tasks', (q) => q.handle(...))
  .queue('tasks-dlq', (q) => q
    .handle('*', AnySchema, async (msg, env) => {
      await alertOps('Message failed permanently', msg);
    })
  );
```
