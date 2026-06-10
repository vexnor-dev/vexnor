import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "url";
import * as vitest from "vitest/config";
import { GetEnvVars } from "env-cmd";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const paths = {
   VEXNOR_ENV_PATH: path.resolve(__dirname, "./env-dev.json"),
   VEXNOR_SQLITE_PATH: path.resolve(__dirname, "./@db-sqlite3/vexnor-dev.sqlite"),
};

for (const [key, value] of Object.entries(paths)) {
   if (value) {
      await fs.access(value).catch((err) => {
         console.error(`Required environment file '${key}' not found at: ${value}`, "n", err);
         process.exit(1);
      });
   }
}

const env = await GetEnvVars({
   rc: {
      environments: ["db"],
      filePath: paths.VEXNOR_ENV_PATH,
   },
   verbose: false,
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type Config = Exclude<Awaited<Parameters<typeof vitest.defineConfig>[0]>, Function>;

export const sharedConfig: Config = {
   test: {
      setupFiles: [path.resolve(__dirname, "vitest.setup.ts")],
      include: ["./**/*.{test,spec}.{ts,js}"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/coverage/**"],
      env: {
         ...paths,
         ...env,
      },
      typecheck: {
         enabled: true,
         checker: "tsc",
      },
      coverage: {
         provider: "v8",
         reportsDirectory: "./coverage",
         reporter: ["text", "html", "json", "json-summary", "clover"],
         include: ["**/src/**/*"],
         exclude: [
            "**/__tests__/**",
            "**/test/**",
            "**/coverage/**",
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
         ],
      },
   },
};
