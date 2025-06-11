import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            'prefer-const': 'error',
        },
    },
    {
        files: ['**/*.test.ts'],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.test.json',
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
    {
        ignores: ['dist/**', 'node_modules/**'],
    }
)
