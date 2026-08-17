import { describe, expect, test } from "vitest";
import { sql, row, param } from "@vexnor/core";
import "@vexnor/mssql";
import { AccountOrderSummary } from "./codegen/vexnor_dev.account_order_summary-view.js";
import { pool } from "./mssql-pool.js";

describe("view — AccountOrderSummary (mssql)", () => {
   test("codegen snapshot", () => {
      expect({
         columns: AccountOrderSummary.colKeys.map((key) => {
            const column = AccountOrderSummary.column(key);
            return { key, columnName: column.columnName, hashId: column.hashId, jsonType: column.jsonType };
         }),
         columnTypes: AccountOrderSummary.columnTypes,
         crud: AccountOrderSummary.crud,
         dbSchema: AccountOrderSummary.dbSchema,
         dialect: AccountOrderSummary.dialect,
         fk: AccountOrderSummary.fk,
         hashId: AccountOrderSummary.hashId,
         pk: AccountOrderSummary.pk,
         source: AccountOrderSummary.source,
         tableInfo: AccountOrderSummary.tableInfo,
      }).toMatchInlineSnapshot(`
        {
          "columnTypes": {
            "latestOrderAt": "Date",
          },
          "columns": [
            {
              "columnName": "account_id",
              "hashId": "SqlTableColumn#(account_order_summary.account_id as accountId)",
              "jsonType": null,
              "key": "accountId",
            },
            {
              "columnName": "email",
              "hashId": "SqlTableColumn#(account_order_summary.email)",
              "jsonType": null,
              "key": "email",
            },
            {
              "columnName": "first_name",
              "hashId": "SqlTableColumn#(account_order_summary.first_name as firstName)",
              "jsonType": null,
              "key": "firstName",
            },
            {
              "columnName": "last_name",
              "hashId": "SqlTableColumn#(account_order_summary.last_name as lastName)",
              "jsonType": null,
              "key": "lastName",
            },
            {
              "columnName": "status",
              "hashId": "SqlTableColumn#(account_order_summary.status)",
              "jsonType": null,
              "key": "status",
            },
            {
              "columnName": "order_count",
              "hashId": "SqlTableColumn#(account_order_summary.order_count as orderCount)",
              "jsonType": null,
              "key": "orderCount",
            },
            {
              "columnName": "latest_order_at",
              "hashId": "SqlTableColumn#(account_order_summary.latest_order_at as latestOrderAt)",
              "jsonType": "Date",
              "key": "latestOrderAt",
            },
          ],
          "crud": {
            "delete": false,
            "insert": false,
            "select": true,
            "update": false,
          },
          "dbSchema": {
            "accountId": {
              "dbType": "uniqueidentifier",
              "type": "string",
            },
            "email": {
              "dbType": "varchar",
              "type": "string",
            },
            "firstName": {
              "dbType": "varchar",
              "type": "string",
            },
            "lastName": {
              "dbType": "varchar",
              "type": "string",
            },
            "latestOrderAt": {
              "dbType": "datetimeoffset",
              "nullable": true,
              "type": "Date",
            },
            "orderCount": {
              "dbType": "int",
              "nullable": true,
              "type": "number",
            },
            "status": {
              "dbType": "varchar",
              "type": "string",
            },
          },
          "dialect": "tsql",
          "fk": [],
          "hashId": "SqlTable#(vexnor_dev.account_order_summary)",
          "pk": [],
          "source": "@vexnor/test-mssql:src/codegen",
          "tableInfo": {
            "name": "account_order_summary",
            "schema": "vexnor_dev",
          },
        }
      `);
      expect(typeof AccountOrderSummary.id).toBe("string");
      for (const key of AccountOrderSummary.colKeys) {
         expect(typeof AccountOrderSummary.column(key).id).toBe("string");
      }
   });

   test("crud is select-only", () => {
      expect(AccountOrderSummary.crud).toMatchInlineSnapshot(`
        {
          "delete": false,
          "insert": false,
          "select": true,
          "update": false,
        }
      `);
   });

   test("SELECT all columns", async () => {
      const results = await sql`
         SELECT ${row(AccountOrderSummary.$$)}
         FROM ${AccountOrderSummary}
      `.mssql.all({ db: pool.request() });
      expect(Array.isArray(results)).toBe(true);
   });

   test("SELECT with WHERE param", async () => {
      const emailParam = param<{ email: string }>("email");
      const results = await sql`
         SELECT ${row(AccountOrderSummary.$$)}
         FROM ${AccountOrderSummary}
         WHERE ${AccountOrderSummary.$email} = ${emailParam}
      `.mssql.all({ db: pool.request(), params: { email: "nonexistent@example.com" } });
      expect(results).toHaveLength(0);
   });

   test("SELECT specific columns", async () => {
      const results = await sql`
         SELECT ${row(AccountOrderSummary.$accountId, AccountOrderSummary.$email, AccountOrderSummary.$orderCount)}
         FROM ${AccountOrderSummary}
      `.mssql.all({ db: pool.request() });
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
         expect(results[0]!.accountId).toBeDefined();
         expect(results[0]!.email).toBeDefined();
         expect(results[0]!.orderCount).toBeDefined();
      }
   });
});
