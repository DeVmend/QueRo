import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'miniflare',
        environmentOptions: {
            modules: true,
            compatibilityDate: '2024-01-01',
        },
    },
})