# Installation

## Package Manager

```bash
# npm
npm install quero valibot

# pnpm
pnpm add quero valibot

# yarn
yarn add quero valibot
```

## Requirements

- Node.js 18+ (for development)
- Cloudflare Workers runtime
- TypeScript 5.0+ (recommended)

## Peer Dependencies

quero uses [Valibot](https://valibot.dev) for schema validation. It's a required peer dependency:

| Package | Version |
|---------|---------|
| valibot | ^1.0.0  |

## TypeScript Configuration

For the best experience, ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

## Wrangler Setup

Add your queue bindings to `wrangler.toml`:

```toml
[[queues.producers]]
queue = "my-queue"
binding = "MY_QUEUE"

[[queues.consumers]]
queue = "my-queue"
max_batch_size = 10
max_retries = 3
```

Or `wrangler.jsonc`:

```json
{
  "queues": {
    "producers": [{ "queue": "my-queue", "binding": "MY_QUEUE" }],
    "consumers": [{ "queue": "my-queue", "max_batch_size": 10 }]
  }
}
```
