import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "url";
import * as vitest from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const paths = {
   VALNOR_ENV_PATH: path.resolve(__dirname, "./env-dev.json"),
   VALNOR_SQLITE_PATH: path.resolve(__dirname, "./@db-sqlite3/valnor-test.sqlite"),
};

console.log("Test environment", paths);

for (const [key, value] of Object.entries(paths)) {
   if (value) {
      await fs.access(value).catch((err) => {
         console.error(`Required environment file '${key}' not found at: ${value}`, "n", err);
         process.exit(1);
      });
   }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type Config = Exclude<Awaited<Parameters<typeof vitest.defineConfig>[0]>, Function>;

export const sharedConfig: Config = {
   test: {
      include: ["./**/*.{test,spec}.{ts,js}"],
      exclude: ["**/node_modules/**", "**/dist/**"],
      env: paths,
      typecheck: {
         enabled: true,
         checker: "tsc",
      },
      coverage: {
         provider: "v8",
         reportsDirectory: "./coverage",
         reporter: ["text", "html", "json"],
         include: ["src/**/*"],
         exclude: ["**/__tests__/**", "**/test/**"],
      },
   },
};
