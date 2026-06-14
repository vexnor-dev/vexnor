import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { SqlQueryHandler, newSqlQueryHandler } from "#/core/query/sql-query-handler.js";
import { SqlQuery, SqlQueryExtended } from "#/core/query/sql-query.js";
import { SqlExecuteMode, SqlRunArgs, RemoteClient } from "#/core/query/sql-query-types.js";
import { SqlRunError } from "#/core/sql-run-error.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { row } from "#/core/query/sql-select-row.js";

type MockResult = { rows: unknown[] };

class MockQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & { Read: MockResult; Write: MockResult; Connection: unknown }
> {
   constructor(
      query: SqlQuery<Pick<T, "Row" | "Params">>,
      private readonly _execute: (mode: SqlExecuteMode) => Promise<MockResult>,
   ) {
      super(query, { pluginName: "mock" });
   }

   resolveRows(result: MockResult): T["Row"][] {
      return result.rows as T["Row"][];
   }

   deserialize<TResult>(result: TResult): TResult {
      return result;
   }

   async execute<TResult>(
      _args: SqlRunArgs<{ Connection: unknown; Params: T["Params"] }>,
      mode: SqlExecuteMode = "write",
   ): Promise<TResult> {
      return this._execute(mode) as TResult;
   }
}

function mockHandler<T extends { Row?: unknown; Params?: unknown }>(
   query: SqlQueryExtended<T>,
   execute: (mode: SqlExecuteMode) => Promise<MockResult>,
) {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   return newSqlQueryHandler(new MockQueryHandler<T>(query, execute) as any);
}

const q = sql`select ${row(Account.$accountId)} from ${Account}`;
const db = {};

describe("SqlQueryHandler — timeout", () => {
   test("throws QUERY_TIMEOUT when execute exceeds timeout", async () => {
      const handler = mockHandler(q, () => new Promise(() => {})); // never resolves
      await expect(handler.run({ db, options: { timeout: 10 } })).rejects.toMatchInlineSnapshot(
         `[SqlRunError: Query timed out after 10ms]`,
      );
   });

   test("QUERY_TIMEOUT error has correct code and retryable=false", async () => {
      const handler = mockHandler(q, () => new Promise(() => {}));
      const err = await handler.run({ db, options: { timeout: 10 } }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SqlRunError);
      expect(err.code).toBe(SqlErrorCode.QUERY_TIMEOUT);
      expect(err.retryable).toBe(false);
   });

   test("resolves normally when execute finishes before timeout", async () => {
      const handler = mockHandler(q, () => Promise.resolve({ rows: [{ accountId: "1" }] }));
      const result = await handler.run({ db, options: { timeout: 1000 } });
      expect(result).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "accountId": "1",
            },
          ],
        }
      `);
   });
});

describe("SqlQueryHandler — retryable option override", () => {
   function driverError(retryable: boolean) {
      return mockHandler(q, () => {
         const err = new SqlRunError(
            "driver error",
            { id: "test", location: null },
            {
               code: SqlErrorCode.QUERY_RETRYABLE_FAILURE,
               retryable,
            },
         );
         return Promise.reject(err);
      });
   }

   function nonSqlError() {
      return mockHandler(q, () => Promise.reject(new Error("connection refused")));
   }

   test("retryable: true — forces retryable=true on a non-retryable SqlRunError", async () => {
      const err = await driverError(false)
         .run({ db, options: { retryable: true } })
         .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SqlRunError);
      expect(err.retryable).toBe(true);
   });

   test("retryable: false — forces retryable=false on a retryable SqlRunError", async () => {
      const err = await driverError(true)
         .run({ db, options: { retryable: false } })
         .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SqlRunError);
      expect(err.retryable).toBe(false);
   });

   test("retryable: default — preserves driver retryable=true", async () => {
      const err = await driverError(true)
         .run({ db, options: { retryable: "default" } })
         .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SqlRunError);
      expect(err.retryable).toBe(true);
   });

   test("retryable: default — preserves driver retryable=false", async () => {
      const err = await driverError(false)
         .run({ db, options: { retryable: "default" } })
         .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SqlRunError);
      expect(err.retryable).toBe(false);
   });

   test("retryable omitted — preserves driver retryable value", async () => {
      const err = await driverError(true)
         .run({ db })
         .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SqlRunError);
      expect(err.retryable).toBe(true);
   });

   test("retryable: true — non-SqlRunError is wrapped with retryable=true", async () => {
      const err = await nonSqlError()
         .run({ db, options: { retryable: true } })
         .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SqlRunError);
      expect(err.code).toBe(SqlErrorCode.QUERY_EXECUTION_FAILED);
      expect(err.retryable).toBe(true);
   });

   test("retryable: false — non-SqlRunError is wrapped with retryable=false", async () => {
      const err = await nonSqlError()
         .run({ db, options: { retryable: false } })
         .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SqlRunError);
      expect(err.retryable).toBe(false);
   });

   test("retryable omitted — non-SqlRunError is wrapped with retryable=false", async () => {
      const err = await nonSqlError()
         .run({ db })
         .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(SqlRunError);
      expect(err.retryable).toBe(false);
   });

   test("retry retries retryable direct local execution failures", async () => {
      let attempts = 0;
      const handler = mockHandler(q, async () => {
         attempts++;
         if (attempts === 1) {
            throw new SqlRunError(
               "temporary driver error",
               { id: "test", location: null },
               {
                  code: SqlErrorCode.QUERY_RETRYABLE_FAILURE,
                  retryable: true,
               },
            );
         }
         return { rows: [{ accountId: "1" }] };
      });

      const result = await handler.run({ db, options: { retry: { maxAttempts: 2 } } });

      expect(attempts).toBe(2);
      expect(result).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "accountId": "1",
            },
          ],
        }
      `);
   });
});

describe("SqlQueryHandler — timeout (remote)", () => {
   test("remote path has no timeout — resolves even when options.timeout is set", async () => {
      // timeout only applies to the local execute() path, not remoteExecute
      const remoteClient: RemoteClient = {
         remoteExecute<TResult>(): Promise<TResult> {
            return new Promise((resolve) => setTimeout(() => resolve({ rows: [] } as TResult), 50));
         },
      };
      const handler = mockHandler(q, () => Promise.resolve({ rows: [] }));
      const result = await handler.run({ db: remoteClient, options: { timeout: 10 } });
      expect(result).toMatchInlineSnapshot(`
        {
          "rows": [],
        }
      `);
   });
});
