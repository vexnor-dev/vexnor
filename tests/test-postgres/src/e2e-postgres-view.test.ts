import { describe, expect, test } from "vitest";
import { sql, row, param } from "vexnor";
import "@vexnor/postgres";
import { AccountOrderSummary } from "./codegen/vexnor_dev.account_order_summary-view.js";
import { pool } from "./postgres-pool.js";

describe("view — AccountOrderSummary (postgres)", () => {
   test("codegen snapshot", () => {
      expect(AccountOrderSummary).toMatchInlineSnapshot(`
        SqlTable {
          "$accountId": SqlTableColumn {
            "columnName": "account_id",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.account_id as accountId)",
            "id": "SqlTableColumn#49(account_order_summary.account_id as accountId)",
            "jsonType": null,
            "key": "accountId",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "vexnor_dev",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$email": SqlTableColumn {
            "columnName": "email",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.email)",
            "id": "SqlTableColumn#50(account_order_summary.email)",
            "jsonType": null,
            "key": "email",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "vexnor_dev",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$firstName": SqlTableColumn {
            "columnName": "first_name",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.first_name as firstName)",
            "id": "SqlTableColumn#51(account_order_summary.first_name as firstName)",
            "jsonType": null,
            "key": "firstName",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "vexnor_dev",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$lastName": SqlTableColumn {
            "columnName": "last_name",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.last_name as lastName)",
            "id": "SqlTableColumn#52(account_order_summary.last_name as lastName)",
            "jsonType": null,
            "key": "lastName",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "vexnor_dev",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$latestOrderAt": SqlTableColumn {
            "columnName": "latest_order_at",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.latest_order_at as latestOrderAt)",
            "id": "SqlTableColumn#55(account_order_summary.latest_order_at as latestOrderAt)",
            "jsonType": "Date",
            "key": "latestOrderAt",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "vexnor_dev",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$orderCount": SqlTableColumn {
            "columnName": "order_count",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.order_count as orderCount)",
            "id": "SqlTableColumn#54(account_order_summary.order_count as orderCount)",
            "jsonType": null,
            "key": "orderCount",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "vexnor_dev",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$status": SqlTableColumn {
            "columnName": "status",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.status)",
            "id": "SqlTableColumn#53(account_order_summary.status)",
            "jsonType": null,
            "key": "status",
            "tableInfo": {
              "name": "account_order_summary",
              "schema": "vexnor_dev",
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
                "id": "SqlTableColumn#49(account_order_summary.account_id as accountId)",
                "jsonType": null,
                "key": "accountId",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "vexnor_dev",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$email": SqlTableColumn {
                "columnName": "email",
                "format": null,
                "hashId": "SqlTableColumn#(account_order_summary.email)",
                "id": "SqlTableColumn#50(account_order_summary.email)",
                "jsonType": null,
                "key": "email",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "vexnor_dev",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$firstName": SqlTableColumn {
                "columnName": "first_name",
                "format": null,
                "hashId": "SqlTableColumn#(account_order_summary.first_name as firstName)",
                "id": "SqlTableColumn#51(account_order_summary.first_name as firstName)",
                "jsonType": null,
                "key": "firstName",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "vexnor_dev",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$lastName": SqlTableColumn {
                "columnName": "last_name",
                "format": null,
                "hashId": "SqlTableColumn#(account_order_summary.last_name as lastName)",
                "id": "SqlTableColumn#52(account_order_summary.last_name as lastName)",
                "jsonType": null,
                "key": "lastName",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "vexnor_dev",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$latestOrderAt": SqlTableColumn {
                "columnName": "latest_order_at",
                "format": null,
                "hashId": "SqlTableColumn#(account_order_summary.latest_order_at as latestOrderAt)",
                "id": "SqlTableColumn#55(account_order_summary.latest_order_at as latestOrderAt)",
                "jsonType": "Date",
                "key": "latestOrderAt",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "vexnor_dev",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$orderCount": SqlTableColumn {
                "columnName": "order_count",
                "format": null,
                "hashId": "SqlTableColumn#(account_order_summary.order_count as orderCount)",
                "id": "SqlTableColumn#54(account_order_summary.order_count as orderCount)",
                "jsonType": null,
                "key": "orderCount",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "vexnor_dev",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$status": SqlTableColumn {
                "columnName": "status",
                "format": null,
                "hashId": "SqlTableColumn#(account_order_summary.status)",
                "id": "SqlTableColumn#53(account_order_summary.status)",
                "jsonType": null,
                "key": "status",
                "tableInfo": {
                  "name": "account_order_summary",
                  "schema": "vexnor_dev",
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
          "columnTypes": {
            "latestOrderAt": "Date",
          },
          "dialect": "postgresql",
          "format": null,
          "hashId": "SqlTable#(vexnor_dev.account_order_summary)",
          "id": "SqlTable#9(vexnor_dev.account_order_summary)",
          "pk": [],
          "tableInfo": {
            "name": "account_order_summary",
            "schema": "vexnor_dev",
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
      `.postgres.all({ db: pool });
      expect(Array.isArray(results)).toBe(true);
   });

   test("SELECT with WHERE param", async () => {
      const emailParam = param<{ email: string }>("email");
      const results = await sql`
         SELECT ${row(AccountOrderSummary.$$)}
         FROM ${AccountOrderSummary}
         WHERE ${AccountOrderSummary.$email} = ${emailParam}
      `.postgres.all({ db: pool, params: { email: "nonexistent@example.com" } });
      expect(results).toHaveLength(0);
   });

   test("SELECT specific columns", async () => {
      const results = await sql`
         SELECT ${row(AccountOrderSummary.$accountId, AccountOrderSummary.$email, AccountOrderSummary.$orderCount)}
         FROM ${AccountOrderSummary}
      `.postgres.all({ db: pool });
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
         expect(results[0]).toHaveProperty("accountId");
         expect(results[0]).toHaveProperty("email");
         expect(results[0]).toHaveProperty("orderCount");
      }
   });
});
