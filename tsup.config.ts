import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    minify: true,
    target: 'es2022',
    platform: 'neutral',
    external: [],
    treeshake: true,
    splitting: false,
    bundle: true,
})
