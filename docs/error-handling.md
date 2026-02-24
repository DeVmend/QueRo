# Error Handling Guide

## Overview

QueRo provides structured error handling for queue message processing with configurable strategies for unknown actions, validation failures, and handler errors.

## Error Classes

| Error Class | When | Default Behavior |
|---|---|---|
| `ValidationError` | Message body missing/invalid `action` field | Message retried |
| `HandlerError` | Handler throws during processing | Message retried |
| `BindingResolutionError` | No binding found for queue name | All messages retried |
| `QueueRouterError` | Base class for all QueRo errors | — |

All error classes are exported from `@devmend/que-ro`.

## Unknown Action Handling

By default, messages with no matching handler are **retried** (not silently acked). This prevents data loss.

```typescript
// Default: retry unknown actions
const router = new QueueRouter<MyEnv>()

// Explicitly ack (use with caution — messages will be lost)
const router = new QueueRouter<MyEnv>(undefined, { onUnhandled: 'ack' })

// Custom fallback handler
const router = new QueueRouter<MyEnv>(undefined, {
    onUnhandled: async (message) => {
        await deadLetterQueue.send(message)
    }
})
```

## Runtime Validation

QueRo validates every message at runtime before dispatching:

- `message.body` must be a non-null object
- `message.body.action` must be a non-empty string

Invalid messages are retried automatically. Use `isActionMessage()` for your own validation:

```typescript
import { isActionMessage } from '@devmend/que-ro'

if (isActionMessage(data)) {
    // data.action is guaranteed to be a string
}
```

## Batch vs Single Handler Error Isolation

**Critical:** Single-handler messages are acked immediately upon success. If a batch handler fails afterward, only the batch-pending messages are retried — already-processed single messages are NOT retried.

```typescript
router
    .action('QUEUE', 'fast-action', handleFast)   // acked immediately on success
    .batch('QUEUE', 'slow-action', handleBatch)    // acked only after batch completes

// If handleBatch throws:
// - fast-action messages: already acked ✅ (no duplicate processing)
// - slow-action messages: retried 🔄
```

## Best Practices

1. **Always handle all known actions** — Register handlers for every action type your queue receives
2. **Use `onUnhandled: 'retry'`** (default) — Prevents silent data loss
3. **Keep single handlers idempotent** — They may be retried on infrastructure failures
4. **Use batch handlers for bulk operations** — Database inserts, API calls that support batching
5. **Prefer `action()` over `batch()`** for critical operations — Single handlers get immediate ack isolation
