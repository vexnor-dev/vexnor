import { describe, expect, it } from "vitest";

import pkg from "../package.json" with { type: "json" };

describe("package scripts", () => {
   it("uses cross-platform lifecycle commands", () => {
      expect({
         buildDependencies: pkg.scripts["build:dependencies"],
         codegen: pkg.scripts["codegen:vexnor"],
         prepare: pkg.scripts["prepare-db"],
         prebuild: pkg.scripts.prebuild,
         pretest: pkg.scripts.pretest,
      }).toMatchInlineSnapshot(`
        {
          "buildDependencies": "pnpm --filter @vexnor/core --filter @vexnor/duckdb run build",
          "codegen": "node ../../packages/core/cli.mjs codegen --plugin @vexnor/duckdb --schema main --camelCaseColumns --uri ./vexnor-dev.duckdb --outDir ./src/codegen",
          "prebuild": "run-s build:dependencies prepare-db codegen:vexnor",
          "prepare": "node --import tsx src/create-test-database.ts",
          "pretest": "run-s build",
        }
      `);
   });
});
