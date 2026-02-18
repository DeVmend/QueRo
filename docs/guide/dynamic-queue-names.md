# Dynamic Queue Names

Configure queue names dynamically based on environment.

## Use Case

When your queue names differ between environments:
- Production: `user-queue-production`
- Staging: `user-queue-staging`
- Development: `user-queue-dev`

## Configuration

Pass a config object to the router with a `name` function:

```typescript
import { QueueRouter } from 'quero'

type Queues = {
  USER_QUEUE: Queue<UserMessage>
}

const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>({
  USER_QUEUE: {
    name: (env) => `user-queue-${env.ENV_NAME}`
  }
})
  .action('USER_QUEUE', 'new-user', async (msg) => {
    // ...
  })
```

## How It Works

1. A batch arrives with `batch.queue = "user-queue-production"`
2. quero calls your `name` function with the env
3. If it returns `"user-queue-production"`, it maps to `USER_QUEUE`
4. Handlers registered for `USER_QUEUE` are invoked

## Static Names

You can also use static strings:

```typescript
const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>({
  USER_QUEUE: {
    name: 'my-custom-queue-name'
  }
})
```

## Manual Mapping

For simple cases, use `mapQueue()`:

```typescript
const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  .mapQueue('user-queue-production', 'USER_QUEUE')
  .mapQueue('user-queue-staging', 'USER_QUEUE')
  .action('USER_QUEUE', 'new-user', async (msg) => {
    // ...
  })
```

## Wrangler Configuration

```json
{
  "vars": {
    "ENV_NAME": "production"
  },
  "queues": {
    "producers": [
      {
        "binding": "USER_QUEUE",
        "queue": "user-queue-production"
      }
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
          {
            "binding": "USER_QUEUE",
            "queue": "user-queue-staging"
          }
        ],
        "consumers": [
          { "queue": "user-queue-staging" }
        ]
      }
    }
  }
}
```

## Auto-Mapping

If you only have one queue binding registered, quero automatically maps any queue name to it:

```typescript
// Only USER_QUEUE is registered
const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  .action('USER_QUEUE', 'new-user', async (msg) => {})

// Any queue name will route to USER_QUEUE handlers
```

When multiple bindings are registered, explicit mapping is required.
