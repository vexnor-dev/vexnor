import path from "node:path";
import { fileURLToPath } from "url";
import { mergeConfig } from "vite";
import { sharedConfig } from "../../vitest.shared.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(sharedConfig, {
   resolve: {
      alias: {
         "@test-models": path.resolve(__dirname, "./src/test/models"),
      },
   },
   test: {
      setupFiles: ["./src/test/setup-test.ts"],
      coverage: {
         provider: "v8",
         reportsDirectory: "./coverage",
         reporter: ["text", "html", "json", "json-summary", "clover"],
         include: ["src/**/*"],
         exclude: [
            "**/__tests__/**",
            "**/test/**",
            "**/coverage/**",
            "**/node_modules/**",
            "**/dist/**",
         ],
      },
   },
});
