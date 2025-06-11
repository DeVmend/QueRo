# Queue Router

A modern, type-safe queue routing library for Cloudflare Workers with TypeScript support.

## Features

- 🚀 **Modern TypeScript** - Full type safety and IntelliSense support
- 🔄 **Flexible Routing** - Route messages to different handlers based on queue names and actions
- 🪶 **Lightweight** - Minimal dependencies, optimized for Cloudflare Workers
- 📝 **Great DX** - Intuitive API with excellent developer experience

## Installation

```bash
pnpm install @devmend/queue-router
```

## Quick Start

```typescript
import { QueueRouter } from '@devmend/queue-router';

type NewUserAction = {
    action: 'new-user';
    userId: string;
    email: string;
}
type DeleteUserAction = {
    action: 'delete-user';
    userId: string;
}
type UserActions = NewUserAction | DeleteUserAction;

type Queues = {
    USER_QUEUE: Queue<UserActions>;
};

const queue = new QueueRouter<{ Bindings: Environment; Queues: Queues }>({
    USER_QUEUE: {           // 👈 Queue Binding like specified in the wrangler config
        name: 'user-queue'  // 👈 Queue name like specified in the wrangler config
    },
});

queue
    .action('USER_QUEUE', 'new-user', (bodies, env, ctx) => {
        for (const body of bodies) {
            const userId = body.userId;
            const email = body.email;
            ...
        }
    })
    .singleMessageAction('USER_QUEUE', 'delete-user', (body, env, ctx) => {
        const userId = body.userId;
        ...
    });

// Export the Worker
export default class HealthCore extends WorkerEntrypoint<{
    Bindings: Environment;
}> {
    async queue(batch: MessageBatch) {
        queue.queue(batch, this.env, this.ctx);
    }
}
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
