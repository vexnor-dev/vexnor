import { describe, expect, test, vi } from "vitest";
import { DuckDBConnection } from "@duckdb/node-api";
import { param, sql } from "@vexnor/core";
import "#src/duckdb-augment.js";

describe("DuckDBQueryHandler", () => {
   test("builds PostgreSQL positional parameters and reads streamed row objects", async () => {
      const db = await DuckDBConnection.create();
      try {
         const query = sql`
            select ${param<{ id: number }>("id")} as "accountId", 'duck@example.com' as "email"
         `;
         const options = query.duckdb.getOptions({ db, params: { id: 1 } });
         const executed = await query.duckdb.execute({ db, params: { id: 1 } });

         expect(options).toMatchInlineSnapshot(`
           {
             "text": "/* <query_0> */
           SELECT
             $1 AS "accountId",
             'duck@example.com' AS "email"
             /* </query_0> */",
             "values": [
               1,
             ],
           }
         `);
         expect(executed).toMatchInlineSnapshot(`
           {
             "rowCount": 1,
             "rows": [
               {
                 "accountId": 1,
                 "email": "duck@example.com",
               },
             ],
             "rowsChanged": 0,
             "statementType": 1,
           }
         `);
      } finally {
         db.closeSync();
      }
   });

   test("wraps build and execution failures", async () => {
      const query = sql`select 1`;
      const handler = query.duckdb;
      const original = query.getSql;
      query.getSql = () => {
         throw new Error("build failed");
      };
      const db = {
         prepare: async () => {
            throw new Error("prepare should not be called for primitive values");
         },
         stream: vi.fn(async () => Promise.reject(new Error("database closed"))),
      };
      expect(() => handler.getOptions({ db })).toThrowErrorMatchingInlineSnapshot(`[SqlRunError: Error building DuckDB query 'SqlQuery#2'. (Error: build failed)]`);
      query.getSql = original;

      await expect(handler.execute({ db })).rejects.toThrowErrorMatchingInlineSnapshot(`[SqlRunError: Error running DUCKDB query 'SqlQuery#2' at null.. (Error: database closed)]`);
   });

   test("keeps prepared statements alive while streaming complex parameter results", async () => {
      const db = await DuckDBConnection.create();
      try {
         const query = sql`select ${param<{ createdAt: Date }>("createdAt")}::timestamp as "createdAt"`;

         const result = await query.duckdb.one({
            db,
            params: { createdAt: new Date("2026-08-10T12:34:56.789Z") },
         });

         expect(result).toMatchInlineSnapshot(`
           {
             "createdAt": 2026-08-10T12:34:56.789Z,
           }
         `);
      } finally {
         db.closeSync();
      }
   });
});
