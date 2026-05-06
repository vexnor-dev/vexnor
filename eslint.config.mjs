import js from "@eslint/js";
import { config, configs } from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";

export default config(
   {
      ignores: ["dist", "deploy"],
   },
   {
      settings: {
         "import/resolver": {
            typescript: {
               project: "packages/*/tsconfig.json",
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
         "unused-imports/no-unused-imports": "error",
         "unused-imports/no-unused-vars": "error",
      },
   },
);
