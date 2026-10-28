import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

export default tseslint.config(
    {
        files: ['src/**/*.ts'],
        extends: [eslint.configs.recommended, ...tseslint.configs.recommended, ...angular.configs.tsRecommended],
        processor: angular.processInlineTemplates,
        rules: {
            // The app is already standalone. This rule flags files that do not repeat the default.
            '@angular-eslint/prefer-standalone': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
        }
    },
    {
        files: ['src/**/*.spec.ts'],
        rules: {
            // Test doubles are structural stubs. Production code still rejects explicit any.
            '@typescript-eslint/no-explicit-any': 'off'
        }
    },
    {
        files: ['src/**/*.html'],
        extends: [...angular.configs.templateRecommended],
        rules: {}
    }
);
