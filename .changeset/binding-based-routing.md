---
"@devmend/que-ro": minor
---

### Binding-based routing for multi-environment support

**New Features:**
- Queue routing now works by binding name instead of queue name
- No more queue name configuration needed for single-queue setups
- New `mapQueue(queueName, binding)` method for explicit runtime mapping
- Dynamic queue names via callback: `{ name: (env) => \`queue-\${env.STAGE}\` }`
- QueueConfig is now generic for proper env type inference in callbacks

**Bug Fixes:**
- Messages are now `ack()`ed only after successful handler execution
- Messages are `retry()`ed on handler errors instead of being silently acknowledged
- Fixed TypeScript error "Type 'action' cannot be used to index type 'T'"
- Warning when multiple bindings registered without explicit queue mapping

**Breaking Changes:**
- None - queue config is now optional, existing code continues to work
