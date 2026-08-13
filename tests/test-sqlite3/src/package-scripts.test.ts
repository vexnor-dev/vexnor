import { describe, expect, it } from "vitest";

import rootPackage from "../../../package.json" with { type: "json" };
import nextPackage from "../../../examples/react-next-app/package.json" with { type: "json" };
import viteApiPackage from "../../../examples/react-vite-api/package.json" with { type: "json" };
import viteUiPackage from "../../../examples/react-vite-ui/package.json" with { type: "json" };
import duckdbPackage from "../../test-duckdb/package.json" with { type: "json" };
import sqlitePackage from "../package.json" with { type: "json" };

describe("file database lifecycle", () => {
   it("recreates worktree-local databases before builds and tests", () => {
      expect({
         createDuckdb: rootPackage.scripts["db-create:duckdb"],
         prepareDuckdb: rootPackage.scripts["db-prepare:duckdb"],
         prepareFiles: rootPackage.scripts["db-prepare:files"],
         prepareSqlite: rootPackage.scripts["db-prepare:sqlite3"],
         resetSqlite: rootPackage.scripts["db-reset:sqlite3"],
         rootPrebuild: rootPackage.scripts.prebuild,
         rootPretest: rootPackage.scripts.pretest,
         duckdbPrepare: duckdbPackage.scripts["prepare-db"],
         examplePrepare: {
            next: nextPackage.scripts["prepare-db"],
            viteApi: viteApiPackage.scripts["prepare-db"],
            viteUi: viteUiPackage.scripts["prepare-db"],
         },
         sqlitePrepare: sqlitePackage.scripts["prepare-db"],
         sqlitePrebuild: sqlitePackage.scripts.prebuild,
      }).toMatchInlineSnapshot(`
        {
          "createDuckdb": "node --import tsx @db-duckdb/create-database.ts",
          "duckdbPrepare": "node --import tsx src/create-test-database.ts",
          "examplePrepare": {
            "next": "pnpm --dir ../.. db-prepare:files",
            "viteApi": "pnpm --dir ../.. db-prepare:files",
            "viteUi": "pnpm --dir ../.. db-prepare:files",
          },
          "prepareDuckdb": "pnpm db-create:duckdb @db-duckdb/vexnor-dev.duckdb",
          "prepareFiles": "run-p db-prepare:sqlite3 db-prepare:duckdb",
          "prepareSqlite": "run-s db-reset:sqlite3 db-migrate:sqlite3",
          "resetSqlite": "pnpm exec rimraf @db-sqlite3/vexnor-dev.sqlite @db-sqlite3/vexnor-dev.sqlite-journal",
          "rootPrebuild": "pnpm db-prepare:files",
          "rootPretest": "pnpm db-prepare:files",
          "sqlitePrebuild": "run-s prepare-db build:dependencies codegen:*",
          "sqlitePrepare": "pnpm --dir ../.. db-prepare:sqlite3",
        }
      `);
   });
});
