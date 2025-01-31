import prettier from 'eslint-plugin-prettier';
import node from 'eslint-plugin-n';
import globals from 'globals';
import js from '@eslint/js';

export default [
  js.configs.recommended,
  node.configs['flat/recommended-script'],
  {
    ignores: ['**/__snapshots__', '**/fixtures', '**/node_modules'],
  },
  {
    plugins: {
      prettier,
    },

    languageOptions: {
      globals: {
        ...globals.commonjs,
      },

      ecmaVersion: 2018,
      sourceType: 'module',
    },

    rules: {
      'no-console': 'off',
      'prettier/prettier': 'error',
    },
  },
  {
    files: ['**/test.js'],

    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
