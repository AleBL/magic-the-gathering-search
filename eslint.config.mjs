import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginJsxA11y from 'eslint-plugin-jsx-a11y';
import pluginPrettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default tseslint.config(
  // Ignored paths
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-electron/**',
      'dist-vite/**',
      'src/dist/**',
      'src/dev-dist/**',
      'main/**',
      'src/out/**'
    ]
  },

  // Base JS recommended
  js.configs.recommended,

  // TypeScript recommended
  ...tseslint.configs.recommended,

  // React recommended (flat)
  {
    ...pluginReact.configs.flat.recommended,
    settings: {
      react: { version: 'detect' }
    }
  },

  // JSX runtime (React 17+ - no need to import React in every file)
  pluginReact.configs.flat['jsx-runtime'],

  // jsx-a11y recommended (flat config)
  {
    ...pluginJsxA11y.flatConfigs.recommended,
    files: ['**/*.{jsx,tsx}']
  },

  // Node-only tooling scripts: no DOM, and .mjs is outside the main block's glob.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2021 },
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' }
    }
  },

  // Main config for all TS/TSX/JS files
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'react-hooks': pluginReactHooks
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      // Prettier
      'prettier/prettier': 'error',

      // TypeScript
      'no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': ['error'],
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',

      // React
      'react/require-default-props': 'off',
      'react/button-has-type': 'off',
      'react/no-children-prop': 'off',
      'react/jsx-props-no-spreading': 'off',
      'react/function-component-definition': [
        'warn',
        {
          namedComponents: 'function-declaration',
          unnamedComponents: 'function-expression'
        }
      ],
      'react/jsx-filename-extension': ['error', { extensions: ['.js', '.jsx', '.ts', '.tsx'] }],

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Formatting
      'eol-last': ['error', 'always'],

      // Native browser dialogs — warn but allow
      'no-alert': 'warn',
      'no-console': 'warn',

      // Restrict translation fallbacks
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='t'][arguments.1.type='Literal']",
          message:
            "Do not use translation fallbacks (e.g. t('key', 'Fallback text')). Add the translation to the locales files instead."
        },

        // Both member forms are covered: el.innerHTML and el['innerHTML'].
        {
          selector: "AssignmentExpression > MemberExpression.left[property.name='innerHTML']",
          message: 'Do not assign to innerHTML. Build nodes with createElement/textContent instead.'
        },
        {
          selector: "AssignmentExpression > MemberExpression.left[computed=true][property.value='innerHTML']",
          message: 'Do not assign to innerHTML. Build nodes with createElement/textContent instead.'
        }
      ]
    }
  },

  // Prettier last (disables conflicting rules)
  pluginPrettier
);
