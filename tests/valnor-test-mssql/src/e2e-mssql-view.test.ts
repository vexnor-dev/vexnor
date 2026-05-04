import { describe, expect, test } from "vitest";
import { sql, row, param } from "valnor";
import "valnor-mssql";
import { AccountOrderSummary } from "./codegen/valnor_test.account_order_summary-view.js";
import { pool } from "./mssql-pool.js";

describe("view — AccountOrderSummary (mssql)", () => {
   test("codegen snapshot", () => {
      expect(AccountOrderSummary).toMatchInlineSnapshot(`
        SqlTable {
          "$accountId": SqlTableColumn {
            "columnName": "account_id",
            "format": null,
            "id": "SqlTableColumn#27(account_order_summary.account_id as accountId)",
            "key": "accountId",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "valnor_test",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$email": SqlTableColumn {
            "columnName": "email",
            "format": null,
            "id": "SqlTableColumn#28(account_order_summary.email)",
            "key": "email",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "valnor_test",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$firstName": SqlTableColumn {
            "columnName": "first_name",
            "format": null,
            "id": "SqlTableColumn#29(account_order_summary.first_name as firstName)",
            "key": "firstName",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "valnor_test",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$lastName": SqlTableColumn {
            "columnName": "last_name",
            "format": null,
            "id": "SqlTableColumn#30(account_order_summary.last_name as lastName)",
            "key": "lastName",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "valnor_test",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$latestOrderAt": SqlTableColumn {
            "columnName": "latest_order_at",
            "format": null,
            "id": "SqlTableColumn#33(account_order_summary.latest_order_at as latestOrderAt)",
            "key": "latestOrderAt",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "valnor_test",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$orderCount": SqlTableColumn {
            "columnName": "order_count",
            "format": null,
            "id": "SqlTableColumn#32(account_order_summary.order_count as orderCount)",
            "key": "orderCount",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "valnor_test",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$status": SqlTableColumn {
            "columnName": "status",
            "format": null,
            "id": "SqlTableColumn#31(account_order_summary.status)",
            "key": "status",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "valnor_test",
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
                "id": "SqlTableColumn#27(account_order_summary.account_id as accountId)",
                "key": "accountId",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "valnor_test",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$email": SqlTableColumn {
                "columnName": "email",
                "format": null,
                "id": "SqlTableColumn#28(account_order_summary.email)",
                "key": "email",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "valnor_test",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$firstName": SqlTableColumn {
                "columnName": "first_name",
                "format": null,
                "id": "SqlTableColumn#29(account_order_summary.first_name as firstName)",
                "key": "firstName",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "valnor_test",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$lastName": SqlTableColumn {
                "columnName": "last_name",
                "format": null,
                "id": "SqlTableColumn#30(account_order_summary.last_name as lastName)",
                "key": "lastName",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "valnor_test",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$latestOrderAt": SqlTableColumn {
                "columnName": "latest_order_at",
                "format": null,
                "id": "SqlTableColumn#33(account_order_summary.latest_order_at as latestOrderAt)",
                "key": "latestOrderAt",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "valnor_test",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$orderCount": SqlTableColumn {
                "columnName": "order_count",
                "format": null,
                "id": "SqlTableColumn#32(account_order_summary.order_count as orderCount)",
                "key": "orderCount",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "valnor_test",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$status": SqlTableColumn {
                "columnName": "status",
                "format": null,
                "id": "SqlTableColumn#31(account_order_summary.status)",
                "key": "status",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "valnor_test",
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
          "dialect": "tsql",
          "format": null,
          "id": "SqlTable#5(valnor_test.account_order_summary)",
          "pk": [],
          "tableInfo": {
            "name": "account_order_summary",
            "schema": "valnor_test",
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
         expect(results[0]).toHaveProperty("accountId");
         expect(results[0]).toHaveProperty("email");
         expect(results[0]).toHaveProperty("orderCount");
      }
   });
});
