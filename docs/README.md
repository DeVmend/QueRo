# quero

> A lightweight, type-safe queue message router for Cloudflare Workers

[![npm version](https://img.shields.io/npm/v/quero.svg)](https://www.npmjs.com/package/quero)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is quero?

**quero** makes it easy to handle queue messages in Cloudflare Workers with full type safety. Instead of writing complex switch statements, you define handlers with schemas and let quero route messages automatically.

## Features

- 🎯 **Type-safe routing** - Messages are validated and typed with [Valibot](https://valibot.dev)
- 🔀 **Multiple queues** - Route different queues to different handlers
- ⚡ **Zero dependencies** - Only peer dependency is Valibot
- 🛡️ **Error handling** - Built-in retry logic and dead letter support
- 📦 **Tiny footprint** - Less than 2KB minified

## Quick Example

```typescript
import { QueueRouter } from 'quero';
import * as v from 'valibot';

const router = new QueueRouter()
  .queue('tasks', (q) => q
    .handle('email', v.object({
      to: v.string(),
      subject: v.string(),
      body: v.string()
    }), async (msg) => {
      await sendEmail(msg.to, msg.subject, msg.body);
    })
    .handle('notification', v.object({
      userId: v.string(),
      message: v.string()
    }), async (msg) => {
      await notify(msg.userId, msg.message);
    })
  );

export default {
  async queue(batch, env, ctx) {
    await router.handle(batch, env, ctx);
  }
};
```

## Installation

```bash
npm install quero valibot
```

## Next Steps

- [Installation Guide](getting-started/installation.md)
- [Quick Start Tutorial](getting-started/quick-start.md)
- [API Reference](api/queue-router.md)
