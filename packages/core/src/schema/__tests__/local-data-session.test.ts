import { describe, expect, test, vi } from "vitest";
import { VexnorConnection, type SqlColumnInfo, type SqlColumnType, type SqlSchema } from "#src/plugin/plugin.js";
import { MockPlugin, type MockConnection } from "#src/test/mock-plugin.js";
import { createSchemaCatalog } from "#src/schema/schema-catalog.js";
import { resolveSchemaSelection } from "#src/schema/schema-selection.js";
import { createLocalDataSession } from "#src/schema/local-data-session.js";

const SESSION_PLUGIN_NAME = "@vexnor/session-test";

const catalogPlugin = {
   name: SESSION_PLUGIN_NAME,
   version: "1.0.0",
   driver: "test",
   dialect: "sql",
   getColumnType(_column: SqlColumnInfo): SqlColumnType {
      return { type: "string" };
   },
};

function schemaCatalog() {
   const schema: SqlSchema = {
      enums: [],
      tables: [
         table("record", "table", true),
         table("event_log", "table", false),
         table("event_view", "view", false),
      ],
   };
   return createSchemaCatalog({ plugin: catalogPlugin, schema });
}

function table(table_name: string, table_type: "table" | "view", withPrimaryKey: boolean): SqlSchema["tables"][number] {
   return {
      table_schema: "alpha",
      table_name,
      table_type,
      columns: [{
         table_schema: "alpha",
         table_name,
         column_name: "record_id",
         column_default: null,
         is_nullable: "NO",
         is_updatable: "YES",
         udt_name: "text",
      }],
      primary_keys: withPrimaryKey
         ? [{ table_schema: "alpha", table_name, constraint_name: `${table_name}_pk`, column_name: "record_id", ordinal_position: 1 }]
         : [],
      foreign_keys: [],
   };
}

async function session(options?: {
   beforeQuery?: () => Promise<void>;
   maxRows?: number;
   timeoutMs?: number;
   maxConcurrency?: number;
   signal?: AbortSignal;
}) {
   const query = vi.fn();
   query.mockImplementation(async () => {
      await options?.beforeQuery?.();
      return { rows: [] };
   });
   const db: MockConnection = { query };
   const plugin = new MockPlugin({ name: SESSION_PLUGIN_NAME });
   const catalog = schemaCatalog();
   const selection = await resolveSchemaSelection({ catalog, request: { mode: "non-interactive", all: true } });
   const close = vi.fn();
   const connection = new VexnorConnection(db, close, null);
   const localSession = await createLocalDataSession({
      plugin,
      connection,
      catalog,
      selection: selection.scope,
      limits: {
         maxRows: options?.maxRows ?? 25,
         timeoutMs: options?.timeoutMs ?? 1000,
         maxConcurrency: options?.maxConcurrency ?? 2,
      },
      signal: options?.signal,
   });
   return { localSession, query, close };
}

describe("createLocalDataSession", () => {
   test("registers one read query for every selected PK, PK-less, and view mapping", async () => {
      const { localSession, query, close } = await session();

      expect({
         mappings: localSession.mappings.mappings.map(({ id, kind }) => ({ id, kind })),
         graph: localSession.graph.tables(),
         queries: localSession.queries,
      }).toMatchInlineSnapshot(`
        {
          "graph": [
            "alpha.event_log",
            "alpha.event_view",
            "alpha.record",
          ],
          "mappings": [
            {
              "id": "alpha.event_log",
              "kind": "table",
            },
            {
              "id": "alpha.event_view",
              "kind": "view",
            },
            {
              "id": "alpha.record",
              "kind": "table",
            },
          ],
          "queries": [
            {
              "columns": [
                "record_id",
              ],
              "hash": "e2397a22a6175f2a74da3466ac0feed37302ca4d3f5f78de391465591f55f779",
              "kind": "read",
              "name": "read_alpha_event_log",
              "objectIds": [
                "alpha.event_log",
              ],
              "plugin": "@vexnor/session-test",
            },
            {
              "columns": [
                "record_id",
              ],
              "hash": "4fc8dcb6948365af6f5dd181705b7c14dbb514a1bb5dc7e79e71133637dbfe10",
              "kind": "read",
              "name": "read_alpha_event_view",
              "objectIds": [
                "alpha.event_view",
              ],
              "plugin": "@vexnor/session-test",
            },
            {
              "columns": [
                "record_id",
              ],
              "hash": "4817c64a52f660477ddd7cc521b5b64d05f3594781e4d284dbd381203b6fdfa0",
              "kind": "read",
              "name": "read_alpha_record",
              "objectIds": [
                "alpha.record",
              ],
              "plugin": "@vexnor/session-test",
            },
          ],
        }
      `);

      const results = [];
      for (const registered of localSession.queries) {
         results.push(await localSession.fetchData({ plugin: registered.plugin, hash: registered.hash, params: {} }));
      }
      expect(results).toMatchInlineSnapshot(`
        [
          {
            "rows": [],
          },
          {
            "rows": [],
          },
          {
            "rows": [],
          },
        ]
      `);
      expect(query.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "/* <query_0> */
        SELECT
          "el_1"."record_id"
        FROM
          "alpha"."event_log" AS "el_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
        LIMIT
          ?
          /* </query_0> */",
            [
              25,
            ],
          ],
          [
            "/* <query_0> */
        SELECT
          "ev_1"."record_id"
        FROM
          "alpha"."event_view" AS "ev_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
        LIMIT
          ?
          /* </query_0> */",
            [
              25,
            ],
          ],
          [
            "/* <query_0> */
        SELECT
          "r_1"."record_id"
        FROM
          "alpha"."record" AS "r_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
        LIMIT
          ?
          /* </query_0> */",
            [
              25,
            ],
          ],
        ]
      `);

      await localSession.close();
      await localSession.close();
      expect(close).toHaveBeenCalledTimes(1);
   });

   test("clamps a supplied limit and rejects unknown query inputs", async () => {
      const { localSession, query } = await session({ maxRows: 10 });
      const registered = localSession.queries[0]!;

      await localSession.fetchData({ plugin: registered.plugin, hash: registered.hash, params: { limit: 500 } });
      expect(query.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "/* <query_0> */
        SELECT
          "el_1"."record_id"
        FROM
          "alpha"."event_log" AS "el_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
        LIMIT
          ?
          /* </query_0> */",
            [
              10,
            ],
          ],
        ]
      `);
      await expect(localSession.fetchData({ plugin: "@vexnor/other", hash: registered.hash, params: {} })).rejects.toThrowErrorMatchingInlineSnapshot(`[InvalidLocalQueryParametersError: Unknown local data plugin: @vexnor/other]`);
      await expect(localSession.fetchData({ plugin: registered.plugin, hash: "unknown-hash", params: {} })).rejects.toThrowErrorMatchingInlineSnapshot(`[InvalidLocalQueryParametersError: Unknown local data query hash: unknown-hash]`);
      await expect(localSession.fetchData({ plugin: registered.plugin, hash: registered.hash, params: { unknown: true } })).rejects.toThrowErrorMatchingInlineSnapshot(`[InvalidLocalQueryParametersError: Unknown local data query parameters: unknown]`);
      await localSession.close();
   });

   test("enforces the concurrency budget", async () => {
      let release: (() => void) | undefined;
      const pending = new Promise<void>((resolve) => { release = resolve; });
      const { localSession } = await session({
         maxConcurrency: 1,
         beforeQuery: async () => {
            await pending;
         },
      });
      const registered = localSession.queries[0]!;
      const first = localSession.fetchData({ plugin: registered.plugin, hash: registered.hash, params: {} });
      await Promise.resolve();

      await expect(localSession.fetchData({ plugin: registered.plugin, hash: registered.hash, params: {} })).rejects.toThrowErrorMatchingInlineSnapshot(`[LocalDataSessionBudgetError: Local data session concurrency limit reached: 1]`);
      release?.();
      await first;
      await localSession.close();
   });

   test("times out, closes the connection, and rejects later work", async () => {
      const { localSession, close } = await session({
         timeoutMs: 5,
         beforeQuery: async () => new Promise(() => {}),
      });
      const registered = localSession.queries[0]!;

      await expect(localSession.fetchData({ plugin: registered.plugin, hash: registered.hash, params: {} })).rejects.toThrowErrorMatchingInlineSnapshot(`[LocalDataSessionTimeoutError: Local data query exceeded the 5ms session timeout]`);
      expect(close).toHaveBeenCalledTimes(1);
      await expect(localSession.fetchData({ plugin: registered.plugin, hash: registered.hash, params: {} })).rejects.toThrowErrorMatchingInlineSnapshot(`[LocalDataSessionClosedError: Local data session is closed]`);
   });

   test("closes and cancels when the host signal aborts", async () => {
      const controller = new AbortController();
      const { localSession, close } = await session({ signal: controller.signal });
      controller.abort();
      await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));

      const registered = localSession.queries[0]!;
      await expect(localSession.fetchData({ plugin: registered.plugin, hash: registered.hash, params: {} })).rejects.toThrowErrorMatchingInlineSnapshot(`[LocalDataSessionCancellationError: Local data session was cancelled]`);
   });
});
