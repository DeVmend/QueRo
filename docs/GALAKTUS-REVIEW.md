# QueRo Review by Galaktus

**Date:** 2026-02-24
**Version reviewed:** 0.5.0 (main branch)
**Reviewer:** Galaktus (AI Code Reviewer)

## Executive Summary

- **Overall Rating: 7/10**
- **Key Strengths:** Excellent type-safety via discriminated unions, clean fluent API, zero dependencies, good DX
- **Critical Issues:** Single-handler ack/retry logic has a subtle bug; no error boundaries per message in batch handlers; `env` passed as `{}` when undefined
- **Recommendations:** Fix ack/retry semantics, add dead-letter / fallback handler support, improve test coverage for error paths

## Code-Review

### Strengths

1. **Clean TypeScript Generics** — The `ActionsOfQueue`, `AllMessageTypes`, and `Extract<T, { action: A }>` pattern provides genuine compile-time safety. Registering a handler for a non-existent action or wrong message shape is caught at build time.

2. **Minimal footprint** — ~330 lines of source, zero runtime deps. Perfect for Workers' size constraints.

3. **Fluent API with `this` return** — `.action().batch().mapQueue()` chaining is ergonomic.

4. **Good build setup** — tsup with ESM, tree-shaking, sourcemaps, dts generation. CI tests on Node 18+20.

5. **Discriminated union pattern** — Using `{ action: string }` as discriminant is idiomatic and plays well with TypeScript's narrowing.

### Issues

#### Critical

**C1: Single-handler messages are acked even when handler throws**

In `processMessage`, single handlers are awaited, but the message is added to `processedMessages` *before* the catch can prevent it — actually looking more carefully: the try/catch in `processBatch` does catch per-message errors and calls `retry()`. However, there's still a problem:

```typescript
// processBatch loop:
try {
    await this.processMessage(binding, message, messagesByAction, env, executionCtx)
    processedMessages.push(message)  // only if no throw — ✅ correct
} catch (error) {
    message.retry()
}
```

Actually this is correct. ~~Retracted.~~

**C1 (revised): Batch handler failure retries ALL messages including successfully-processed single-handler messages**

```typescript
// After single messages processed successfully:
try {
    await this.processMultiHandlers(messagesByAction, env, executionCtx)
    for (const message of processedMessages) { message.ack() }
} catch (error) {
    // ALL messages retried, including ones handled by single handlers!
    for (const message of processedMessages) { message.retry() }
}
```

If you have a mix of `action()` and `batch()` handlers on the same queue, a batch handler failure causes *already-processed* single-handler messages to be retried — leading to **duplicate processing**. This is a real bug.

**Severity: Critical** — Can cause duplicate side effects (e.g., double user creation).

**Fix:** Track single-handled messages separately and ack them immediately, or separate ack logic per handler type.

#### High

**H1: `env` defaults to `{} as E['Bindings']` when undefined**

```typescript
// queue-router.ts line ~20
return config.name(env ?? ({} as E['Bindings']))
```

This silently passes an empty object that satisfies the type but will cause runtime errors when the function accesses `env.STAGE` etc. Should throw an explicit error if env is required but not provided.

**H2: No fallback/catch-all handler**

If a message arrives with an unknown action, it's silently warned and... the message is still added to `processedMessages` and acked. Actually — looking at the code: `processMessage` returns without error for unknown actions, so the message *is* pushed to `processedMessages` and acked. This means **unhandled messages are silently consumed and lost**.

```typescript
if (!handler) {
    console.warn(`No handler found for action: ${action}`)
    return  // no throw → message gets acked
}
```

**Severity: High** — Silent data loss for unhandled message types.

**Fix:** Either retry unhandled messages, or add an `.onUnhandled()` fallback handler, or make it configurable (ack vs retry vs dead-letter).

**H3: No `executionCtx` passed through to handler despite type signature**

The `action()` and `batch()` method signatures accept `executionCtx` in the handler type, but `addAction` doesn't propagate it. The actual `Handler` type in `types.ts` does include it, but looking at the flow:

- `addAction` wraps the handler but the cast `handler as (body: ActionMessage) => void` drops the extra params
- In `processMessage`, `handler.handle(message.body, env, executionCtx)` — this does pass it ✅

Actually this works because the `handle` function signature in the `Handler` type accepts all three params. The cast is loose but functional. **Medium risk** — the cast could mask bugs.

#### Medium

**M1: Handler key collision potential**

```typescript
buildHandlerKey(binding: string, action: string): string {
    return `${binding}:${action}`
}
```

If a binding name contains `:`, this could collide. Unlikely in practice (Cloudflare bindings don't use colons) but worth a defensive check or different separator.

**M2: `queueToBinding` cache is never invalidated**

The `registerQueueBinding` method caches queue→binding mappings permanently. If used in a long-lived Worker (durable objects or tests), stale mappings could cause issues. Workers are typically short-lived, so low risk.

**M3: `resolveBindingFromQueueName` iterates all configs every time on cache miss**

For many queues this could be O(n) per batch. Pre-build the reverse map in the constructor instead.

**M4: Type exports are incomplete**

`src/index.ts` only exports `QueueRouter`. Users can't import `ActionMessage`, `ActionQueue`, `Env`, etc. for advanced use cases. Should re-export key types.

#### Low

**L1: `vitest-environment-miniflare` is a devDep but unused** — config uses `environment: 'node'`. Remove dead dependency.

**L2: `eslint` config uses `--ext .ts` which is ESLint 8 syntax** — with ESLint 9 flat config, this flag is ignored. The `eslint.config.js` likely handles it, but the npm script is misleading.

**L3: Version mismatch** — package.json says 0.5.0 but task says 0.4.3. Minor but worth noting.

### Recommendations

1. **Separate ack timing for single vs batch handlers** to prevent C1
2. **Add `.onUnhandled()` fallback handler** with configurable behavior (retry/ack/callback)
3. **Throw explicit error** when `env` is required but missing (H1)
4. **Re-export types** from index.ts
5. **Remove unused `vitest-environment-miniflare` dep**

## Architecture-Review

### Current Architecture

```
QueueRouter<E extends Env>
  ├── handlers: Map<"binding:action", Handler>     # action routing
  ├── queueToBinding: Map<queueName, binding>      # runtime resolution
  ├── action(binding, action, handler)              # single-message handler
  ├── batch(binding, action, handler)               # batch handler
  ├── mapQueue(queueName, binding)                  # explicit mapping
  └── queue(batch, env, ctx)                        # entry point
```

Message flow: `batch.queue` → resolve binding → for each message → lookup `binding:action` → dispatch to single or collect for batch → process batches → ack/retry.

### Strengths

1. **Binding-based routing is the right call** — Decouples code from queue names. The PR #1 evolution from name-based to binding-based was correct. This makes multi-env deployments trivial.

2. **Single entry point** — `router.queue(batch, env, ctx)` is dead simple to integrate. One line in the Worker handler.

3. **Discriminated union + Extract pattern** — This is the gold standard for type-safe message routing in TypeScript. The compiler ensures exhaustive handling.

4. **Progressive complexity** — Simple case (one queue, no config) just works. Complex case (multi-queue, dynamic names) is opt-in.

5. **No framework lock-in** — Works with any Worker setup, no special wrangler plugins needed.

### Issues

1. **No middleware/plugin system** — Can't add cross-cutting concerns (logging, metrics, retries, validation) without modifying the library. Compare to Hono's middleware pattern.

2. **No dead-letter queue (DLQ) support** — After max retries, messages vanish. Should support routing failed messages to a DLQ.

3. **No per-message error isolation in batch mode** — One bad message in a batch poisons the whole batch. Should support configurable error strategies.

4. **No message validation at runtime** — Type safety is compile-time only. A malformed message (missing `action` field) will cause `undefined` lookups silently. Add runtime validation or at least a guard.

5. **Single `action` discriminator is hardcoded** — What if someone wants `type` or `event` as the discriminant? The `ActionMessage = { action: string }` constraint is baked in.

### Recommendations

1. **Add middleware support:**
   ```typescript
   router.use('USER_QUEUE', async (msg, env, next) => {
       console.log('Processing:', msg.action)
       await next()
   })
   ```

2. **Add runtime message validation:**
   ```typescript
   if (!message.body || typeof message.body.action !== 'string') {
       message.retry()
       continue
   }
   ```

3. **Configurable error strategy:**
   ```typescript
   new QueueRouter<E>({}, {
       onUnhandled: 'retry',     // 'ack' | 'retry' | handler
       onError: 'retry',
       maxRetries: 3,
       deadLetterQueue: 'DLQ_BINDING'
   })
   ```

4. **Support custom discriminators** (nice-to-have):
   ```typescript
   new QueueRouter<E>({ discriminator: 'type' })
   ```

### Future Improvements

- **Observability hooks** — `onProcessed`, `onError`, `onRetry` callbacks for metrics
- **Message schemas** with Zod/Valibot validation
- **Typed `send()` helper** — Wrap `env.QUEUE.send()` with the same type safety
- **Concurrency control** — `maxConcurrency` per action handler
- **Cloudflare Queue rate limiting integration**

### Comparison with Alternatives

There aren't many direct competitors for CF Queue routing specifically. The closest patterns:

| Feature | QueRo | Manual routing | Hono (HTTP) |
|---------|-------|---------------|-------------|
| Type-safe dispatch | ✅ Excellent | ❌ Manual | ✅ (for HTTP) |
| Queue-specific | ✅ | ✅ | ❌ |
| Middleware | ❌ | ❌ | ✅ |
| Batch support | ✅ | Manual | N/A |
| Zero deps | ✅ | ✅ | ❌ |

QueRo fills a genuine gap. The closest alternative is a manual switch statement, which provides no type safety.

## Test Review

### Coverage

- ✅ Binding-based routing
- ✅ Config-based routing
- ✅ Dynamic queue names
- ✅ Single + batch handlers
- ✅ Method chaining
- ❌ **Missing:** Error handling paths (handler throws, unknown action, missing env)
- ❌ **Missing:** Multi-queue routing (two bindings, interleaved messages)
- ❌ **Missing:** `ack()` / `retry()` verification (mocks exist but not asserted)
- ❌ **Missing:** Edge cases (empty batch, message without `action` field, duplicate action registration)

**Test quality: 6/10** — Happy paths are covered, but the interesting edge cases and error scenarios are untested.

## Action Items

### High Priority
- [ ] **Fix C1:** Separate ack logic for single vs batch handlers to prevent duplicate processing
- [ ] **Fix H2:** Don't silently ack unhandled messages — retry or provide fallback handler
- [ ] **Fix H1:** Throw when env is required (function-based name) but not provided
- [ ] **Add tests for error paths** — handler throws, unknown actions, malformed messages
- [ ] **Add runtime validation** for `message.body.action` existence

### Medium Priority
- [ ] **Re-export types** from `src/index.ts` (`ActionMessage`, `ActionQueue`, `Env`, etc.)
- [ ] **Remove `vitest-environment-miniflare`** unused dependency
- [ ] **Add `.onUnhandled()` fallback handler API**
- [ ] **Add tests for ack/retry** — assert mocks are called correctly
- [ ] **Pre-build reverse queue→binding map** in constructor

### Nice to Have
- [ ] Middleware/plugin system for cross-cutting concerns
- [ ] Configurable discriminator field (not just `action`)
- [ ] Dead-letter queue support
- [ ] Typed `send()` helper for producing messages
- [ ] Observability hooks (onProcessed, onError)
- [ ] Message schema validation with Zod/Valibot integration
- [ ] Concurrency control per handler

---

*Review conducted on the full source code of QueRo v0.5.0 (main branch, 2026-02-24). ~490 lines of source + tests reviewed.*
