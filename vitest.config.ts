import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        // Miniflare environment requires built dist/, use node for unit tests
        environment: 'node',
    },
})
