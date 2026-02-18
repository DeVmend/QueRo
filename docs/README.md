# quero

> Type-safe queue message routing for Cloudflare Workers

## Features

- 🎯 **Full type safety** – Messages and handlers are fully typed
- ⚡ **Single & batch handlers** – Process messages individually or in batches
- 🔀 **Multi-queue support** – Route multiple queues with one router
- 📦 **Zero dependencies** – No external runtime dependencies

## Installation

```bash
npm install quero
```

## Quick Example

```typescript
import { QueueRouter } from 'quero'

// Define your message types
type UserMessage = 
  | { action: 'created'; userId: string; email: string }
  | { action: 'deleted'; userId: string }

// Define your queues
type Queues = {
  USER_QUEUE: Queue<UserMessage>
}

// Create the router
const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  .action('USER_QUEUE', 'created', async (msg) => {
    console.log(`User created: ${msg.email}`)
  })
  .action('USER_QUEUE', 'deleted', async (msg) => {
    console.log(`User deleted: ${msg.userId}`)
  })

// Wire up your worker
export default {
  async queue(batch, env) {
    await router.queue(batch, env)
  }
}
```

## How It Works

1. Define message types with an `action` field as discriminator
2. Create a `Queues` type mapping binding names to queue types
3. Register handlers with `.action()` or `.batch()`
4. Call `router.queue(batch, env)` in your queue handler

[Get started →](getting-started/quick-start.md)
