import js from "@eslint/js";
import unusedImports from "eslint-plugin-unused-imports";
import { config, configs } from "typescript-eslint";

export default config(
   {
      ignores: [
         "**/.next/**",
         "**/coverage/**",
         "**/deploy/**",
         "**/dist/**",
         "examples/*/shared/codegen/**",
         "orms/prisma/src/__tests__/fixtures*/generated/**",
         "tests/*/prisma/generated/**",
         "tests/*/src/codegen/**",
      ],
   },
   {
      linterOptions: {
         reportUnusedDisableDirectives: false,
      },
   },
   {
      settings: {
         "import/resolver": {
            typescript: {
               project: ["packages/*/tsconfig.json", "plugins/*/tsconfig.json", "orms/*/tsconfig.json"],
            },
         },
      },
      extends: [js.configs.recommended, ...configs.recommended],
      files: ["**/*.{ts,tsx}"],
      languageOptions: {
         ecmaVersion: 2020,
      },
      plugins: {
         "unused-imports": unusedImports,
      },
      rules: {
         "@typescript-eslint/no-unused-vars": "off",
         "no-useless-escape": ["error", { allowRegexCharacters: ["/"] }],
         "unused-imports/no-unused-imports": "error",
         "unused-imports/no-unused-vars": [
            "error",
            {
               argsIgnorePattern: "^_",
               varsIgnorePattern: "^_",
            },
         ],
      },
   },
   {
      files: ["**/__tests__/**/*.{ts,tsx}", "**/*.{test,spec}.{ts,tsx}"],
      linterOptions: {
         reportUnusedDisableDirectives: false,
      },
      rules: {
         "@typescript-eslint/no-empty-object-type": "off",
         "@typescript-eslint/no-explicit-any": "off",
         "@typescript-eslint/no-unsafe-function-type": "off",
         "no-useless-escape": "off",
         "unused-imports/no-unused-vars": "off",
      },
   },
   {
      files: ["tests/test-*/src/**/*.ts"],
      rules: {
         "@typescript-eslint/no-explicit-any": "error",
      },
   },
);
