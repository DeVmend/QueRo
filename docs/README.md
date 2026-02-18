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

## Example

```typescript
const router = new QueueRouter<{ Bindings: Env; Queues: Queues }>()
  .action('USER_QUEUE', 'new-user', async (msg) => {
    console.log(`Welcome ${msg.email}!`)
  })
  .action('USER_QUEUE', 'delete-user', async (msg) => {
    console.log(`Goodbye ${msg.userId}`)
  })
```

[Get started →](getting-started/quick-start.md)
