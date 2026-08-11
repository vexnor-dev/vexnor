import { describe, expect, test, vi } from "vitest";
import { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getQueryMeta, row, setQueryMeta, sql, SqlRunError, type QueryMeta } from "@vexnor/core";
import { Account } from "@vexnor/core/testing";
import { DuckDBQueryHandler, type DuckDBClient } from "#src/duckdb-query-handler.js";
import { DuckDBTokenizer } from "#src/duckdb-tokenizer.js";
import { DuckDBUnsupportedError, savepoint, transaction } from "#src/duckdb-transaction.js";
import { VexnorDuckDB } from "#src/vexnor-duckdb.js";
import "#src/duckdb-augment.js";

describe("DuckDBTokenizer", () => {
   const tokenizer = new DuckDBTokenizer("runtime-test");

   test("tokenizes DuckDB SQL while skipping comments and quoted content", () => {
      expect([
         tokenizer.tokenize("SELECT -- line\n* FROM t"),
         tokenizer.tokenize("SELECT * -- trailing"),
         tokenizer.tokenize("SELECT /* block */ `ignored` FROM t"),
         tokenizer.tokenize("SELECT /* unclosed"),
         tokenizer.tokenize("SELECT 'text', \"identifier\", $$body$$ FROM t"),
         tokenizer.tokenize("SELECT 'unclosed"),
         tokenizer.tokenize("select"),
         tokenizer.tokenize("SELECT 42, 3.5 FROM t WHERE x >= 1"),
         tokenizer.tokenize("SELECT ;"),
      ]).toMatchInlineSnapshot(`
        [
          [
            "select",
            "*",
            "from",
            "t",
          ],
          [
            "select",
            "*",
          ],
          [
            "select",
            "from",
            "t",
          ],
          [
            "select",
          ],
          [
            "select",
            ",",
            ",",
            "from",
            "t",
          ],
          [
            "select",
          ],
          [
            "select",
          ],
          [
            "select",
            "42,",
            "3.5",
            "from",
            "t",
            "where",
            "x",
            ">=",
            "1",
          ],
          [
            "select",
          ],
        ]
      `);
   });

   test("rejects raw parameter markers", () => {
      expect(() => tokenizer.tokenize("SELECT @value")).toThrow("forbidden parameter characters");
      expect(() => tokenizer.tokenize("SELECT $1")).toThrow("forbidden parameter characters");
   });
});

describe("DuckDB transactions", () => {
   test("commits successful callbacks and rolls back failures", async () => {
      const connection = await DuckDBConnection.create();
      try {
         await connection.run("create table event (id integer)");
         const result = await transaction(connection, async (db) => {
            await db.run("insert into event values (1)");
            return "committed";
         });
         await expect(transaction(connection, async (db) => {
            await db.run("insert into event values (2)");
            throw new Error("rollback");
         })).rejects.toThrow("rollback");
         const rows = (await connection.runAndReadAll("select id from event order by id")).getRowsJS();

         expect({ result, rows }).toMatchInlineSnapshot(`
           {
             "result": "committed",
             "rows": [
               [
                 1,
               ],
             ],
           }
         `);
      } finally {
         connection.closeSync();
      }
   });

   test("reports DuckDB's unsupported savepoint capability", () => {
      expect(() => savepoint()).toThrowErrorMatchingInlineSnapshot(`[DuckDBUnsupportedError: DuckDB does not support savepoints]`);
      const error = new DuckDBUnsupportedError("nested transactions");
      expect({ name: error.name, code: error.code, message: error.message }).toMatchInlineSnapshot(`
        {
          "code": "DUCKDB_UNSUPPORTED",
          "message": "DuckDB does not support nested transactions",
          "name": "DuckDBUnsupportedError",
        }
      `);
   });
});

describe("DuckDBQueryHandler result and error behavior", () => {
   const query = sql`select ${row(Account.$accountId, Account.$createdAt)} from ${Account}`;
   const handler = query.duckdb;

   test("resolves, serializes, and deserializes result envelopes", () => {
      const input = {
         rows: [{ accountId: "id-1", createdAt: new Date("2026-08-10T12:00:00.000Z") }],
         rowCount: 1,
         rowsChanged: 0,
         statementType: 1,
      };
      setQueryMeta(input, { duration: 1 });
      const remote = Reflect.apply(handler.deserialize, handler, [{
         ...input,
         rows: [{ accountId: "id-1", createdAt: "2026-08-10T12:00:00.000Z" }],
      }, true]);
      const serialized = handler.serialize(input);
      const withoutMeta = handler.serialize({
         rows: [],
         rowCount: 0,
         rowsChanged: 0,
         statementType: 1,
      });

      expect({ resolved: handler.resolveRows(serialized), remoteRows: remote.rows }).toMatchInlineSnapshot(`
        {
          "remoteRows": [
            {
              "accountId": "id-1",
              "createdAt": 2026-08-10T12:00:00.000Z,
            },
          ],
          "resolved": [
            {
              "accountId": "id-1",
              "createdAt": 2026-08-10T12:00:00.000Z,
            },
          ],
        }
      `);
      expect(getQueryMeta(serialized)).toBeDefined();
      expect(getQueryMeta(withoutMeta)).toBeUndefined();
      expect(() => Reflect.apply(handler.deserialize, handler, [{ invalid: true }, false])).toThrow("rows");
   });

   test("classifies retryable and non-retryable execution failures", async () => {
      const retryableDb: DuckDBClient = {
         prepare: async () => { throw new Error("prepare unavailable"); },
         stream: async () => { throw new Error("transaction conflict"); },
      };
      const nonRetryableDb: DuckDBClient = {
         prepare: async () => { throw new Error("prepare unavailable"); },
         stream: async () => { throw "not an Error"; },
      };

      const executeError = async (db: DuckDBClient): Promise<SqlRunError> => {
         try {
            await handler.execute({ db });
         } catch (error) {
            if (error instanceof SqlRunError) return error;
            throw error;
         }
         throw new Error("Expected DuckDB execution to fail");
      };
      const retryable = await executeError(retryableDb);
      const nonRetryable = await executeError(nonRetryableDb);

      expect([retryable.retryable, retryable.code, nonRetryable.retryable, nonRetryable.code]).toMatchInlineSnapshot(`
        [
          true,
          "QUERY_RETRYABLE_FAILURE",
          false,
          "QUERY_EXECUTION_FAILED",
        ]
      `);
   });

   test("records debug input and execution metadata", async () => {
      const connection = await DuckDBConnection.create();
      try {
         const debug = vi.fn();
         const meta: QueryMeta = { duration: 1 };
         const simple = sql`select 1 as id`;
         const result = await simple.duckdb.execute({ db: connection, options: { debug } }, undefined, meta);

         expect(debug).toHaveBeenCalledOnce();
         expect({ result, sql: meta.sql, params: meta.params }).toMatchInlineSnapshot(`
           {
             "params": [],
             "result": {
               "rowCount": 1,
               "rows": [
                 {
                   "id": 1,
                 },
               ],
               "rowsChanged": 0,
               "statementType": 1,
             },
             "sql": "/* <query_0> */
           SELECT
             1 AS id /* </query_0> */",
           }
         `);
      } finally {
         connection.closeSync();
      }
   });
});

describe("VexnorDuckDB plugin", () => {
   test("keeps augmentation idempotent when the module is evaluated again", async () => {
      const core = await import("@vexnor/core");
      vi.doMock("@vexnor/core", () => core);
      vi.resetModules();
      try {
         await import("#src/duckdb-augment.js");
      } finally {
         vi.doUnmock("@vexnor/core");
      }

      expect(Object.hasOwn(sql`select 1`.source.constructor.prototype, "duckdb")).toBe(true);
      expect(Object.hasOwn(Account.constructor.prototype, "duckdb")).toBe(true);
   });

   test("exposes its complete plugin identity and query handler", () => {
      const plugin = new VexnorDuckDB();
      const query = sql`select 1`;
      const pluginHandler = Reflect.apply(plugin.newQueryHandler, plugin, [query.source]);
      if (!(pluginHandler instanceof DuckDBQueryHandler)) throw new TypeError("Expected a DuckDBQueryHandler");
      expect({
         name: plugin.name,
         driver: plugin.driver,
         dialect: plugin.dialect,
         library: plugin.getLibrary(),
         handler: pluginHandler.pluginName,
         columnType: plugin.getColumnType({
            column_default: null,
            column_name: "enabled",
            data_type: "BOOLEAN",
            is_nullable: "NO",
            is_updatable: "YES",
            table_name: "settings",
            table_schema: "main",
         }),
      }).toMatchInlineSnapshot(`
        {
          "columnType": {
            "type": "boolean",
          },
          "dialect": "postgresql",
          "driver": "duckdb",
          "handler": "@vexnor/duckdb",
          "library": [],
          "name": "@vexnor/duckdb",
        }
      `);
   });

   test("creates isolated memory connections and closes them idempotently", async () => {
      const plugin = new VexnorDuckDB();
      const connection = await plugin.createConnection({ config: { uri: ":memory:" } });
      await connection.db.run("create table isolated (id integer)");
      await connection.close();
      await connection.close();

      await expect(connection.db.run("select * from isolated")).rejects.toThrow("connection disconnected");
   });

   test("reuses file instances until the final connection closes", async () => {
      const directory = mkdtempSync(join(tmpdir(), "vexnor-duckdb-cache-"));
      const path = join(directory, "cache.duckdb");
      try {
         const plugin = new VexnorDuckDB();
         const first = await plugin.createConnection({ config: { mode: "file", path } });
         const second = await plugin.createConnection({ config: { mode: "file", path } });
         await first.db.run("create table shared (id integer)");
         await first.close();
         await second.db.run("insert into shared values (1)");
         const rows = (await second.db.runAndReadAll("select * from shared")).getRowObjects();
         await second.close();

         expect(rows).toMatchInlineSnapshot(`
           [
             {
               "id": 1,
             },
           ]
         `);
      } finally {
         rmSync(directory, { recursive: true, force: true });
      }
   });

   test("releases failed cache acquisitions and connections", async () => {
      const directory = mkdtempSync(join(tmpdir(), "vexnor-duckdb-failure-"));
      const path = join(directory, "failure.duckdb");
      try {
         const plugin = new VexnorDuckDB();
         const fromCache = vi.spyOn(DuckDBInstance, "fromCache").mockRejectedValueOnce(new Error("cache unavailable"));
         const cacheError = await plugin.createConnection({ config: { mode: "file", path } }).catch((error: Error) => error.message);
         fromCache.mockRestore();

         const connect = vi.spyOn(DuckDBInstance.prototype, "connect").mockRejectedValueOnce(new Error("connect unavailable"));
         const connectError = await plugin.createConnection({ config: { mode: "file", path } }).catch((error: Error) => error.message);
         connect.mockRestore();

         const recovered = await plugin.createConnection({ config: { mode: "file", path } });
         await recovered.db.run("select 1");
         await recovered.close();

         expect({ cacheError, connectError }).toMatchInlineSnapshot(`
           {
             "cacheError": "cache unavailable",
             "connectError": "connect unavailable",
           }
         `);
      } finally {
         vi.restoreAllMocks();
         rmSync(directory, { recursive: true, force: true });
      }
   });

   test("requires at least one schema", async () => {
      const plugin = new VexnorDuckDB();
      await expect(plugin.getSchema({ mode: "memory", schemas: [] })).rejects.toThrow("At least one DuckDB schema");
   });

   test("describes non-file connection modes without exposing MotherDuck tokens", async () => {
      const configs = [
         { mode: "memory" as const },
         { mode: "motherduck" as const, database: "analytics", token: "secret" },
         { uri: ":memory:" },
         { uri: "md:analytics?motherduck_token=secret" },
         { uri: "analytics.duckdb" },
      ];
      const schemas = [];

      for (const config of configs) {
         const plugin = new VexnorDuckDB();
         const memory = await plugin.createConnection({ config: { mode: "memory" } });
         vi.spyOn(plugin, "createConnection").mockResolvedValue(memory);
         schemas.push(await plugin.getSchema({ ...config, schemas: ["main"] }));
      }

      expect(schemas).toMatchInlineSnapshot(`
        [
          {
            "enums": [],
            "tables": [],
          },
          {
            "enums": [],
            "tables": [],
          },
          {
            "enums": [],
            "tables": [],
          },
          {
            "enums": [],
            "tables": [],
          },
          {
            "enums": [],
            "tables": [],
          },
        ]
      `);
   });
});
