import { describe, expect, test } from "vitest";
import { sql, row, param } from "@vexnor/core";
import "@vexnor/sqlite3";
import { AccountOrderSummary } from "./codegen/main.account_order_summary-view.js";
import { db } from "./config.js";

describe("view — AccountOrderSummary (sqlite)", () => {
   test("codegen snapshot", () => {
      expect(AccountOrderSummary).toMatchInlineSnapshot(`
        SqlTable {
          "$accountId": SqlTableColumn {
            "columnName": "account_id",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.account_id as accountId)",
            "id": "SqlTableColumn#19(account_order_summary.account_id as accountId)",
            "jsonType": null,
            "key": "accountId",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$email": SqlTableColumn {
            "columnName": "email",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.email)",
            "id": "SqlTableColumn#20(account_order_summary.email)",
            "jsonType": null,
            "key": "email",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$firstName": SqlTableColumn {
            "columnName": "first_name",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.first_name as firstName)",
            "id": "SqlTableColumn#21(account_order_summary.first_name as firstName)",
            "jsonType": null,
            "key": "firstName",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$lastName": SqlTableColumn {
            "columnName": "last_name",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.last_name as lastName)",
            "id": "SqlTableColumn#22(account_order_summary.last_name as lastName)",
            "jsonType": null,
            "key": "lastName",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$latestOrderAt": SqlTableColumn {
            "columnName": "latest_order_at",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.latest_order_at as latestOrderAt)",
            "id": "SqlTableColumn#25(account_order_summary.latest_order_at as latestOrderAt)",
            "jsonType": null,
            "key": "latestOrderAt",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$orderCount": SqlTableColumn {
            "columnName": "order_count",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.order_count as orderCount)",
            "id": "SqlTableColumn#24(account_order_summary.order_count as orderCount)",
            "jsonType": null,
            "key": "orderCount",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$status": SqlTableColumn {
            "columnName": "status",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.status)",
            "id": "SqlTableColumn#23(account_order_summary.status)",
            "jsonType": null,
            "key": "status",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "_$$": Lazy {
            "_computed": false,
            "_value": null,
            "callback": [Function],
          },
          "_cols": Lazy {
            "_computed": true,
            "_value": {
              "$accountId": SqlTableColumn {
                "columnName": "account_id",
                "format": null,
                "hashId": "SqlTableColumn#(account_order_summary.account_id as accountId)",
                "id": "SqlTableColumn#19(account_order_summary.account_id as accountId)",
                "jsonType": null,
                "key": "accountId",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$email": SqlTableColumn {
                "columnName": "email",
                "format": null,
                "hashId": "SqlTableColumn#(account_order_summary.email)",
                "id": "SqlTableColumn#20(account_order_summary.email)",
                "jsonType": null,
                "key": "email",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$firstName": SqlTableColumn {
                "columnName": "first_name",
                "format": null,
                "hashId": "SqlTableColumn#(account_order_summary.first_name as firstName)",
                "id": "SqlTableColumn#21(account_order_summary.first_name as firstName)",
                "jsonType": null,
                "key": "firstName",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$lastName": SqlTableColumn {
                "columnName": "last_name",
                "format": null,
                "hashId": "SqlTableColumn#(account_order_summary.last_name as lastName)",
                "id": "SqlTableColumn#22(account_order_summary.last_name as lastName)",
                "jsonType": null,
                "key": "lastName",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$latestOrderAt": SqlTableColumn {
                "columnName": "latest_order_at",
                "format": null,
                "hashId": "SqlTableColumn#(account_order_summary.latest_order_at as latestOrderAt)",
                "id": "SqlTableColumn#25(account_order_summary.latest_order_at as latestOrderAt)",
                "jsonType": null,
                "key": "latestOrderAt",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$orderCount": SqlTableColumn {
                "columnName": "order_count",
                "format": null,
                "hashId": "SqlTableColumn#(account_order_summary.order_count as orderCount)",
                "id": "SqlTableColumn#24(account_order_summary.order_count as orderCount)",
                "jsonType": null,
                "key": "orderCount",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$status": SqlTableColumn {
                "columnName": "status",
                "format": null,
                "hashId": "SqlTableColumn#(account_order_summary.status)",
                "id": "SqlTableColumn#23(account_order_summary.status)",
                "jsonType": null,
                "key": "status",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
            },
            "callback": [Function],
          },
          "_crudConfig": {
            "delete": false,
            "insert": false,
            "select": true,
            "update": false,
          },
          "_out": Lazy {
            "_computed": false,
            "_value": null,
            "callback": [Function],
          },
          "columnTypes": {},
          "dialect": "sqlite",
          "format": null,
          "hashId": "SqlTable#(main.account_order_summary)",
          "id": "SqlTable#4(main.account_order_summary)",
          "pk": [],
          "tableInfo": {
            "name": "account_order_summary",
            "schema": "main",
          },
          "tag": null,
          "type": "SqlTable",
        }
      `);
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
      `.sqlite.all({ db });
      expect(Array.isArray(results)).toBe(true);
   });

   test("SELECT with WHERE param", async () => {
      const emailParam = param<{ email: string }>("email");
      const results = await sql`
         SELECT ${row(AccountOrderSummary.$$)}
         FROM ${AccountOrderSummary}
         WHERE ${AccountOrderSummary.$email} = ${emailParam}
      `.sqlite.all({ db, params: { email: "nonexistent@example.com" } });
      expect(results).toHaveLength(0);
   });

   test("SELECT specific columns", async () => {
      const results = await sql`
         SELECT ${row(AccountOrderSummary.$accountId, AccountOrderSummary.$email, AccountOrderSummary.$orderCount)}
         FROM ${AccountOrderSummary}
      `.sqlite.all({ db });
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
         expect(results[0]).toHaveProperty("accountId");
         expect(results[0]).toHaveProperty("email");
         expect(results[0]).toHaveProperty("orderCount");
      }
   });
});
