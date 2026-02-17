<div align="center">
    <img src="https://raw.githubusercontent.com/DeVmend/QueRo/refs/heads/main/assets/que-ro.png" width="250" height="auto" alt="Que Ro"/>
</div>
<h2 align="center" style="font-weight: 700; color: #6c47ff;">
  Effortless, elegant queue routing for Cloudflare Workers <span style="font-size:1.2em;">✨</span>
</h2>
<p align="center" style="font-size:1.1em; color: #555;">
  <em>Type-safe. Minimal. Developer-first.</em>
</p>

## Features

A modern, type-safe queue routing library for Cloudflare Workers with TypeScript support.

- 🚀 **Modern TypeScript** - Full type safety and IntelliSense support
- 🔄 **Flexible Routing** - Route messages to different handlers based on bindings and actions
- 🪶 **Lightweight** - No dependencies, optimized for Cloudflare Workers
- 📝 **Great DX** - Intuitive API with excellent developer experience
- 🌍 **Environment-agnostic** - Works across prod, staging, dev without config changes

## Installation

```bash
pnpm install @devmend/que-ro
```

## Quick Start

```typescript
import { QueueRouter } from '@devmend/que-ro'

// Define your message types
type UserActions = 
    | { action: 'new-user'; userId: string; email: string }
    | { action: 'delete-user'; userId: string }

// Define your queues
type Queues = {
    USER_QUEUE: Queue<UserActions>
}

// Create router - no queue names needed!
const queueRouter = new QueueRouter<{ Queues: Queues }>()

// Register handlers by binding name
queueRouter
    .action('USER_QUEUE', 'new-user', async (message, env) => {
        console.log('New user:', message.userId)
    })
    .batch('USER_QUEUE', 'delete-user', async (messages, env) => {
        console.log('Delete users:', messages.map(m => m.userId))
    })

export default {
    async queue(batch, env) {
        await queueRouter.queue(batch, env)
    },
}
```

## Multi-Environment Support

The queue name is resolved at runtime from `batch.queue`, so your code works across all environments:

```typescript
// wrangler.toml (production)
[[queues.consumers]]
queue = "user-queue-prod"
binding = "USER_QUEUE"

// wrangler.toml (staging)  
[[queues.consumers]]
queue = "user-queue-stage"
binding = "USER_QUEUE"
```

Same code, different queue names - no changes needed! 🎉

### Explicit Queue Mapping

If you need explicit control, you can still map queue names to bindings:

```typescript
// Option 1: Static mapping
const router = new QueueRouter<{ Queues: Queues }>({
    USER_QUEUE: { name: 'user-queue-prod' }
})

// Option 2: Dynamic from environment
const router = new QueueRouter<{ Queues: Queues; Bindings: Env }>({
    USER_QUEUE: { name: (env) => `user-queue-${env.STAGE}` }
})

// Option 3: Runtime mapping
const router = new QueueRouter<{ Queues: Queues }>()
    .mapQueue('user-queue-prod', 'USER_QUEUE')
    .mapQueue('user-queue-stage', 'USER_QUEUE')
```

## API

### `action(binding, action, handler)`
Registers a handler that processes each message individually.

```typescript
router.action('USER_QUEUE', 'new-user', (message, env, ctx) => {
    // Called once per message
})
```

### `batch(binding, action, handler)`
Registers a handler that processes all messages of an action type together.

```typescript
router.batch('USER_QUEUE', 'new-user', (messages, env, ctx) => {
    // Called once with all messages of this action
})
```

### `mapQueue(queueName, binding)`
Explicitly maps a queue name to a binding (useful for complex setups).

```typescript
router.mapQueue('my-custom-queue-name', 'USER_QUEUE')
```

### `queue(batch, env, ctx)`
Main entry point - call this from your Worker's queue handler.

```typescript
export default {
    async queue(batch, env, ctx) {
        await router.queue(batch, env, ctx)
    }
}
```

## Development

```bash
pnpm install    # Install dependencies
pnpm test       # Run tests
pnpm run build  # Build the library
pnpm run lint   # Lint code
pnpm run format # Format code
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
