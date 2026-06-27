import { describe, expect, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { parseCallerLocation } from "#src/core/utils/caller-location.js";

const INTERNAL_URL_BROWSER =
   "http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/packages/vexnor/dist/core/query/sql-query.js";

const INTERNAL_URL_SERVER =
   "file:///Users/adrian/Work/vexnor-dev/packages/vexnor/src/core/query/sql-query.ts";

describe("sql location", () => {
   test("location is a string or null — never undefined", () => {
      const query = sql`SELECT 1`;
      expect(query.location === null || typeof query.location === "string").toBe(true);
   });

   test(".authorize() preserves location from original query", () => {
      const query = sql`SELECT 1`;
      const tagged = query.authorize("admin");
      expect(tagged.location).toBe(query.location);
   });
});

describe("parseCallerLocation — browser (Vite/@fs)", () => {
   test("plain sql`` call", () => {
      const stack = [
         "Error",
         "    at new SqlQuery (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/packages/vexnor/dist/core/query/sql-query.js:71:23)",
         "    at sql (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/packages/vexnor/dist/core/sql.js:33:19)",
         "    at http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/examples/react-vite-api/shared/queries/postgres.ts:8:23",
      ].join("\n");
      expect(parseCallerLocation(stack, INTERNAL_URL_BROWSER)).toMatchInlineSnapshot(`
        {
          "location": "examples/react-vite-api/shared/queries/postgres.ts:8:23",
          "locationUrl": "http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/examples/react-vite-api/shared/queries/postgres.ts",
        }
      `);
   });

   test("CRUD select — subquery via jsonOne charm", () => {
      const stack = [
         "Error",
         "    at new SqlQuery (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/packages/vexnor/dist/core/query/sql-query.js:71:23)",
         "    at sql (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/packages/vexnor/dist/core/sql.js:33:19)",
         "    at http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/plugins/postgres/dist/charms/json-aggregation-postgres.js:96:29",
         "    at Cache.get (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/packages/vexnor/dist/lib/cache.js:10:23)",
         "    at jsonOne (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/plugins/postgres/dist/charms/json-aggregation-postgres.js:94:18)",
         "    at http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/plugins/postgres/dist/crud/postgres-select.js:13:85",
         "    at Array.map (<anonymous>)",
         "    at postgresSelect (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/plugins/postgres/dist/crud/postgres-select.js:13:51)",
         "    at handler.select (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/plugins/postgres/dist/crud/postgres-table-handler.js:62:36)",
         "    at http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/examples/react-vite-api/shared/queries/postgres.ts:20:48",
      ].join("\n");
      expect(parseCallerLocation(stack, INTERNAL_URL_BROWSER)).toMatchInlineSnapshot(`
        {
          "location": "examples/react-vite-api/shared/queries/postgres.ts:20:48",
          "locationUrl": "http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/examples/react-vite-api/shared/queries/postgres.ts",
        }
      `);
   });

   test("CRUD select — sql`` inside postgresSelect", () => {
      const stack = [
         "Error",
         "    at new SqlQuery (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/packages/vexnor/dist/core/query/sql-query.js:71:23)",
         "    at sql (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/packages/vexnor/dist/core/sql.js:33:19)",
         "    at postgresSelect (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/plugins/postgres/dist/crud/postgres-select.js:21:33)",
         "    at handler.select (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/plugins/postgres/dist/crud/postgres-table-handler.js:62:36)",
         "    at http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/examples/react-vite-api/shared/queries/postgres.ts:20:48",
      ].join("\n");
      expect(parseCallerLocation(stack, INTERNAL_URL_BROWSER)).toMatchInlineSnapshot(`
        {
          "location": "examples/react-vite-api/shared/queries/postgres.ts:20:48",
          "locationUrl": "http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/examples/react-vite-api/shared/queries/postgres.ts",
        }
      `);
   });

   test("CRUD select — PostgresQueryHandler construction", () => {
      const stack = [
         "Error",
         "    at new SqlQuery (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/packages/vexnor/dist/core/query/sql-query.js:71:23)",
         "    at new SqlQueryHandler (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/packages/vexnor/dist/core/query/sql-query-handler.js:16:9)",
         "    at new PostgresQueryHandler (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/plugins/postgres/dist/postgres-query-handler.js:13:9)",
         "    at Proxy.get (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/plugins/postgres/dist/postgres-augment.js:6:35)",
         "    at Reflect.get (<anonymous>)",
         "    at Object.get (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/packages/vexnor/dist/core/query/sql-query.js:624:32)",
         "    at postgresSelect (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/plugins/postgres/dist/crud/postgres-select.js:27:6)",
         "    at handler.select (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/plugins/postgres/dist/crud/postgres-table-handler.js:62:36)",
         "    at http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/examples/react-vite-api/shared/queries/postgres.ts:20:48",
      ].join("\n");
      expect(parseCallerLocation(stack, INTERNAL_URL_BROWSER)).toMatchInlineSnapshot(`
        {
          "location": "examples/react-vite-api/shared/queries/postgres.ts:20:48",
          "locationUrl": "http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/examples/react-vite-api/shared/queries/postgres.ts",
        }
      `);
   });

   test("lazy handler construction from React useState — non-/@fs/ frame", () => {
      const stack = [
         "Error",
         "    at new SqlQuery (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/packages/vexnor/dist/core/query/sql-query.js:71:23)",
         "    at new SqlQueryHandler (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/packages/vexnor/dist/core/query/sql-query-handler.js:16:9)",
         "    at new PostgresQueryHandler (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/plugins/postgres/dist/postgres-query-handler.js:13:9)",
         "    at Proxy.get (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/plugins/postgres/dist/postgres-augment.js:6:35)",
         "    at Reflect.get (<anonymous>)",
         "    at Object.get (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/packages/vexnor/dist/core/query/sql-query-handler.js:216:32)",
         "    at http://localhost:5173/src/pages/postgres-accounts.tsx:36:56",
         "    at mountStateImpl (http://localhost:5173/@fs/Users/adrian/Work/vexnor-dev/examples/react-vite-api/node_modules/.vite/deps/react-dom_client.js?v=a0498a7f:4588:20)",
      ].join("\n");
      expect(parseCallerLocation(stack, INTERNAL_URL_BROWSER)).toMatchInlineSnapshot(`
        {
          "location": "/src/pages/postgres-accounts.tsx:36:56",
          "locationUrl": "http://localhost:5173/src/pages/postgres-accounts.tsx",
        }
      `);
   });
});

describe("parseCallerLocation — server (Node/tsx src)", () => {
   test("plain sql`` at module load", () => {
      const stack = [
         "Error",
         "    at new SqlQuery (/Users/adrian/Work/vexnor-dev/packages/vexnor/src/core/query/sql-query.ts:104:21)",
         "    at sql (/Users/adrian/Work/vexnor-dev/packages/vexnor/src/core/sql.ts:45:18)",
         "    at <anonymous> (/Users/adrian/Work/vexnor-dev/examples/react-vite-api/shared/queries/postgres.ts:10:20)",
         "    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)",
         "    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5)",
      ].join("\n");
      expect(parseCallerLocation(stack, INTERNAL_URL_SERVER)).toMatchInlineSnapshot(`
        {
          "location": "examples/react-vite-api/shared/queries/postgres.ts:10:20",
          "locationUrl": "file:///Users/adrian/Work/vexnor-dev/examples/react-vite-api/shared/queries/postgres.ts",
        }
      `);
   });

   test("CRUD select factory at module load", () => {
      const stack = [
         "Error",
         "    at new SqlQuery (/Users/adrian/Work/vexnor-dev/packages/vexnor/src/core/query/sql-query.ts:104:21)",
         "    at new SqlQueryHandler (/Users/adrian/Work/vexnor-dev/packages/vexnor/src/core/query/sql-query-handler.ts:26:7)",
         "    at new PostgresQueryHandler (/Users/adrian/Work/vexnor-dev/plugins/postgres/src/postgres-query-handler.ts:40:7)",
         "    at Proxy.get (/Users/adrian/Work/vexnor-dev/plugins/postgres/src/postgres-augment.ts:23:33)",
         "    at Reflect.get (<anonymous>)",
         "    at Object.get (/Users/adrian/Work/vexnor-dev/packages/vexnor/src/core/query/sql-query.ts:727:53)",
         "    at postgresSelect (/Users/adrian/Work/vexnor-dev/plugins/postgres/src/crud/postgres-select.ts:56:6)",
         "    at Object.handler.select (/Users/adrian/Work/vexnor-dev/plugins/postgres/src/crud/postgres-table-handler.ts:156:10)",
         "    at <anonymous> (/Users/adrian/Work/vexnor-dev/examples/react-vite-api/shared/queries/postgres.ts:24:48)",
         "    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)",
      ].join("\n");
      expect(parseCallerLocation(stack, INTERNAL_URL_SERVER)).toMatchInlineSnapshot(`
        {
          "location": "examples/react-vite-api/shared/queries/postgres.ts:24:48",
          "locationUrl": "file:///Users/adrian/Work/vexnor-dev/examples/react-vite-api/shared/queries/postgres.ts",
        }
      `);
   });

   test("via sql-select-value Object.as", () => {
      const stack = [
         "Error",
         "    at new SqlQuery (/Users/adrian/Work/vexnor-dev/packages/vexnor/src/core/query/sql-query.ts:104:21)",
         "    at Object.as (/Users/adrian/Work/vexnor-dev/packages/vexnor/src/core/query/sql-select-value.ts:107:31)",
         "    at <anonymous> (/Users/adrian/Work/vexnor-dev/plugins/postgres/src/schema/find-enums.ts:14:39)",
         "    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)",
         "    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5)",
      ].join("\n");
      // find-enums.ts is a plugin-internal file — location should be null
      expect(parseCallerLocation(stack, INTERNAL_URL_SERVER)).toMatchInlineSnapshot(`
        {
          "location": null,
          "locationUrl": null,
        }
      `);
   });

   test("registry.execute constructs handler at request time — points to server handler", () => {
      const stack = [
         "Error",
         "    at new SqlQuery (/Users/adrian/Work/vexnor-dev/packages/vexnor/src/core/query/sql-query.ts:104:21)",
         "    at new SqlQueryHandler (/Users/adrian/Work/vexnor-dev/packages/vexnor/src/core/query/sql-query-handler.ts:26:7)",
         "    at new PostgresQueryHandler (/Users/adrian/Work/vexnor-dev/plugins/postgres/src/postgres-query-handler.ts:40:7)",
         "    at VexnorPostgres.newQueryHandler (/Users/adrian/Work/vexnor-dev/plugins/postgres/src/vexnor-postgres.ts:104:14)",
         "    at SqlQueryRegistry.execute (/Users/adrian/Work/vexnor-dev/packages/vexnor/src/execution/sql-query-registry.ts:191:35)",
         "    at <anonymous> (/Users/adrian/Work/vexnor-dev/examples/react-vite-api/server/src/server.ts:103:42)",
         "    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)",
         "    at async dispatch (file:///Users/adrian/Work/vexnor-dev/node_modules/.pnpm/hono@4.12.23/node_modules/hono/dist/compose.js:22:17)",
      ].join("\n");
      expect(parseCallerLocation(stack, INTERNAL_URL_SERVER)).toMatchInlineSnapshot(`
        {
          "location": "examples/react-vite-api/server/src/server.ts:103:42",
          "locationUrl": "file:///Users/adrian/Work/vexnor-dev/examples/react-vite-api/server/src/server.ts",
        }
      `);
   });

   test("returns null when all non-node frames are internal", () => {
      const stack = [
         "Error",
         "    at new SqlQuery (/Users/adrian/Work/vexnor-dev/packages/vexnor/src/core/query/sql-query.ts:104:21)",
         "    at sql (/Users/adrian/Work/vexnor-dev/packages/vexnor/src/core/sql.ts:45:18)",
         "    at JsonAggregationPostgres.write (/Users/adrian/Work/vexnor-dev/plugins/postgres/src/charms/json-aggregation-postgres.ts:69:30)",
         "    at Proxy.build (/Users/adrian/Work/vexnor-dev/packages/vexnor/src/core/sql-base.ts:96:15)",
         "    at Proxy.getSql (/Users/adrian/Work/vexnor-dev/packages/vexnor/src/core/query/sql-query.ts:561:12)",
      ].join("\n");
      expect(parseCallerLocation(stack, INTERNAL_URL_SERVER).location).toBeNull();
   });
});

describe("parseCallerLocation — external user (npm install)", () => {
   test("user project outside monorepo — path returned as-is", () => {
      const stack = [
         "Error",
         "    at new SqlQuery (file:///home/user/node_modules/vexnor/dist/core/query/sql-query.js:74:45)",
         "    at sql (file:///home/user/node_modules/vexnor/dist/core/sql.js:33:19)",
         "    at Object.<anonymous> (/home/user/my-app/src/queries.ts:5:14)",
         "    at node:internal/modules/esm/module_job:343:25",
      ].join("\n");
      expect(parseCallerLocation(stack, INTERNAL_URL_SERVER)).toMatchInlineSnapshot(`
        {
          "location": "/home/user/my-app/src/queries.ts:5:14",
          "locationUrl": "file:///home/user/my-app/src/queries.ts",
        }
      `);
   });
});
