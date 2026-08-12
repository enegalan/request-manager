import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
    {
        ignores: ['dist/**', 'node_modules/**'],
    },
    js.configs.recommended,
    prettier,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.jest,
                axios: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    caughtErrors: 'none',
                    varsIgnorePattern: '^_',
                },
            ],
            'no-empty': ['error', { allowEmptyCatch: true }],
        },
    },
    {
        files: ['__tests__/**'],
        rules: {
            'no-unused-vars': 'off',
        },
    },
];
