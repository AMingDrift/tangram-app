import antfu from '@antfu/eslint-config';
import nextPlugin from '@next/eslint-plugin-next';
import eslintConfigPrettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import perfectionist from 'eslint-plugin-perfectionist';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
// import tailwind from 'eslint-plugin-tailwindcss';
import unusedImports from 'eslint-plugin-unused-imports';

export default antfu(
    {
        isInEditor: false,
        react: true,
        typescript: true,
        stylistic: false,
        markdown: false,
        toml: false,
        ignores: [
            'public',
            'node_modules',
            'build',
            '.history',
            '.next',
            'public',
            'pnpm-lock.yaml',
            'package-lock.json',
            'next-env.d.ts',
        ],
    },
    {
        files: ['**/*.{ts,tsx,js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
        },
        rules: {
            'no-console': 'off',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'ts/no-use-before-define': 'off',
            'ts/strict-boolean-expressions': 'off',
            'ts/no-unsafe-member-access': 'off',
            'ts/no-unsafe-call': 'off',
            'ts/no-unsafe-assignment': 'off',
            'ts/no-unsafe-return': 'off',
            'ts/no-unsafe-argument': 'off',
            'ts/no-misused-promises': 'off',
            'ts/no-floating-promises': 'off',
            'node/prefer-global/process': 'off',
            'node/prefer-global/buffer': 'off',
            'import/no-named-default': 'off',
            'react-hooks/exhaustive-deps': 'off',
            'react-refresh/only-export-components': 'off',
            'react/no-leaked-conditional-rendering': 'off',
            'react/no-forward-ref': 'off',
            'jsdoc/check-param-names': 'off',
        },
    },
    // ...tailwind.configs['flat/recommended'],
    jsxA11y.flatConfigs.recommended,
    {
        plugins: {
            '@next/next': nextPlugin,
        },
        rules: {
            ...nextPlugin.configs.recommended.rules,
            ...nextPlugin.configs['core-web-vitals'].rules,
        },
    },
    {
        name: 'perfectionist',
        rules: {
            'import/order': 'off',
            'sort-imports': 'off',
            'perfectionist/sort-imports':
                perfectionist.configs['recommended-natural'].rules['perfectionist/sort-imports'],
            'perfectionist/sort-exports':
                perfectionist.configs['recommended-natural'].rules['perfectionist/sort-exports'],
            'perfectionist/sort-named-imports':
                perfectionist.configs['recommended-natural'].rules[
                    'perfectionist/sort-named-imports'
                ],
            'perfectionist/sort-named-exports':
                perfectionist.configs['recommended-natural'].rules[
                    'perfectionist/sort-named-exports'
                ],
        },
    },
    {
        plugins: {
            'unused-imports': unusedImports,
        },
        rules: {
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                },
            ],
        },
    },
    // {
    //     name: 'tailwind',
    //     rules: {
    //         'tailwindcss/no-custom-classname': 'off',
    //         'tailwindcss/enforces-shorthand': 'off',
    //     },
    // },
    eslintConfigPrettier,
    eslintPluginPrettierRecommended,
);
