import { beforeAll, describe, expect, test } from "vitest";
import { param } from "@vexnor/core";
import { DuckDBSelectCommand, sql } from "@vexnor/duckdb";
import { Account, type IAccountSelect } from "./codegen/main.account-table.js";
import { db } from "./config.js";
import { insertAccount } from "./fixtures.js";

describe("DuckDB windowBy e2e", { concurrent: false }, () => {
   let accounts: IAccountSelect[];

   beforeAll(async () => {
      accounts = [];
      for (const name of ["Alpha", "Bravo", "Charlie"]) accounts.push(await insertAccount(`window-${name}`));
   });

   test("row_number and rank execute against DuckDB", async () => {
      const result = await new DuckDBSelectCommand(Account, {
         WHERE: sql`${Account.$accountId} in (${accounts.map(({ accountId }) => accountId)})`,
         ORDER_BY: sql`${Account.$email} asc`,
         windowBy: {
            rowNumber: { fn: "row_number", over: { orderBy: { email: "ASC" } } },
            emailRank: { fn: "rank", over: { orderBy: { email: "ASC" } } },
         },
      }).execute().all({ db, params: {} });

      expect(result.map(({ rowNumber, emailRank }) => ({ rowNumber, emailRank }))).toMatchInlineSnapshot(`
        [
          {
            "emailRank": 1n,
            "rowNumber": 1n,
          },
          {
            "emailRank": 2n,
            "rowNumber": 2n,
          },
          {
            "emailRank": 3n,
            "rowNumber": 3n,
          },
        ]
      `);
   });

   test("dense_rank and ntile execute against DuckDB", async () => {
      const result = await new DuckDBSelectCommand(Account, {
         WHERE: sql`${Account.$accountId} in (${accounts.map(({ accountId }) => accountId)})`,
         windowBy: {
            denseRank: { fn: "dense_rank", over: { orderBy: { email: "ASC" } } },
            tile: { fn: "ntile", args: 2, over: { orderBy: { email: "ASC" } } },
         },
      }).execute().all({ db, params: {} });

      expect(result.map(({ denseRank, tile }) => ({ denseRank, tile }))).toMatchInlineSnapshot(`
        [
          {
            "denseRank": 1n,
            "tile": 1n,
          },
          {
            "denseRank": 2n,
            "tile": 1n,
          },
          {
            "denseRank": 3n,
            "tile": 2n,
          },
        ]
      `);
   });

   test("lag, lead, first_value, and last_value execute against DuckDB", async () => {
      const result = await new DuckDBSelectCommand(Account, {
         WHERE: sql`${Account.$accountId} in (${accounts.map(({ accountId }) => accountId)})`,
         ORDER_BY: sql`${Account.$email} asc`,
         windowBy: {
            previous: { fn: "lag", col: "email", args: 1, over: { orderBy: { email: "ASC" } } },
            next: { fn: "lead", col: "email", args: 1, over: { orderBy: { email: "ASC" } } },
            first: { fn: "first_value", col: "email", over: { orderBy: { email: "ASC" } } },
            last: { fn: "last_value", col: "email", over: { orderBy: { email: "ASC" } } },
         },
      }).execute().all({ db, params: {} });
      const emails = result.map(({ email }) => email);
      const position = (email: string | null) => email === null ? null : emails.indexOf(email) + 1;

      expect(result.map(({ previous, next, first, last }) => ({
         previous: position(previous),
         next: position(next),
         first: position(first),
         last: position(last),
      }))).toMatchInlineSnapshot(`
        [
          {
            "first": 1,
            "last": 1,
            "next": 2,
            "previous": null,
          },
          {
            "first": 1,
            "last": 2,
            "next": 3,
            "previous": 1,
          },
          {
            "first": 1,
            "last": 3,
            "next": null,
            "previous": 2,
          },
        ]
      `);
   });

   test("parameterized window limits execute against DuckDB", async () => {
      const result = await new DuckDBSelectCommand(Account, {
         WHERE: sql`${Account.$accountId} in (${accounts.map(({ accountId }) => accountId)})`,
         limit: param<{ limit: number }>("limit"),
         windowBy: { count: { fn: "count", col: "*", over: {} } },
      }).execute().all({ db, params: { limit: 2 } });

      expect(result.map(({ count }) => count)).toMatchInlineSnapshot(`
        [
          3n,
          3n,
        ]
      `);
   });
});
