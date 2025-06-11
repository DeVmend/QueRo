<div align="center">
    <img src="https://github.com/DeVmend/QueRo/blob/main/assets/que-ro.png" width="250" height="auto" alt="Que Ro"/>
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
- 🔄 **Flexible Routing** - Route messages to different handlers based on queue names and actions
- 🪶 **Lightweight** - No dependencies, optimized for Cloudflare Workers
- 📝 **Great DX** - Intuitive API with excellent developer experience

## Installation

```bash
pnpm install @devmend/que-ro
```

## Quick Start

```typescript
// index.ts

import { QueueRouter } from '@devmend/que-ro'

// 👇 define your message types by actions
type NewUser = {
    action: 'new-user'
    userId: string
    email: string
}
type DeleteUser = {
    action: 'delete-user'
    userId: string
}
type UserActions = NewUser | DeleteUser

// 👇 define your queues with their actions
type Queues = {
    USER_QUEUE: Queue<UserActions>
}

// 👇 create a queue router specify his Binding and name as configured in wrangler.json
const queueRouter = new QueueRouter<{ Bindings: Environment; Queues: Queues }>({
    USER_QUEUE: { name: 'user-queue' },
})

// 👇 add actions to the queue like defining api routes and handle them type safe
queueRouter
    .action('USER_QUEUE', 'new-user', async messages => {
        console.log(messages) // 👈 get array of messages as configured size in wrangler.json
    })
    .singleMessageAction('USER_QUEUE', 'delete-user', async message => {
        console.log(message) // 👈 callback handles every message by action on his own
    })

export default {
    async fetch(req, env): Promise<Response> {
        // example fetch handler for testing
        env.USER_QUEUE.send({
            action: 'new-user',
            userId: 'foo',
            email: 'foo@bar.com',
        })
        return new Response('Sent message to the queue')
    },
    // 👇 "link" the queue router to the queue
    async queue(batch, env): Promise<void> {
        queueRouter.queue(batch, env)
    },
} satisfies ExportedHandler<Environment, Error>

// 👇 also possible to export the queue router directly if no other handlers are needed
// export default queueRouter;
```

## API Documentation

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the library
pnpm run build

# Run tests in watch mode
pnpm run test:watch

# Lint code
pnpm run lint

# Format code
pnpm run format
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
