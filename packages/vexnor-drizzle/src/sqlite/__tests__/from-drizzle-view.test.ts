import { describe, expect, test } from "vitest";
import { sqliteView, text, integer } from "drizzle-orm/sqlite-core";
import { sql, row, param, SqlTable } from "vexnor";
import { fromDrizzleView } from "../index.js";

const accountOrderSummaryDrizzle = sqliteView("account_order_summary", {
   accountId: text("account_id"),
   email: text("email"),
   firstName: text("first_name"),
   orderCount: integer("order_count"),
}).existing();

describe("fromDrizzleView (sqlite) — metadata", () => {
   test("throws if called with a builder instead of .existing()", () => {
      const builder = sqliteView("test", { id: text("id") });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => fromDrizzleView(builder as any)).toThrow("Call .existing() or .as");
   });

   test("returns SqlTable instance", () => {
      expect(fromDrizzleView(accountOrderSummaryDrizzle)).toBeInstanceOf(SqlTable);
   });

   test("fromDrizzleView — no schema", () => {
      expect(fromDrizzleView(accountOrderSummaryDrizzle).tableInfo.schema).toMatchInlineSnapshot(`null`);
   });

   test("fromDrizzleView — schema override", () => {
      expect(fromDrizzleView(accountOrderSummaryDrizzle, "main").tableInfo.schema).toMatchInlineSnapshot(`"main"`);
   });

   test("pk is empty", () => {
      expect(fromDrizzleView(accountOrderSummaryDrizzle).pk).toMatchInlineSnapshot(`[]`);
   });

   test("crud is select-only", () => {
      expect(fromDrizzleView(accountOrderSummaryDrizzle).crud).toMatchInlineSnapshot(`
        {
          "delete": false,
          "insert": false,
          "select": true,
          "update": false,
        }
      `);
   });

   test("fromDrizzleView — full snapshot", () => {
      expect(fromDrizzleView(accountOrderSummaryDrizzle, "main")).toMatchInlineSnapshot(`
        SqlTable {
          "$accountId": SqlTableColumn {
            "columnName": "account_id",
            "format": null,
            "id": "SqlTableColumn#1(account_order_summary.account_id as accountId)",
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
            "id": "SqlTableColumn#2(account_order_summary.email)",
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
            "id": "SqlTableColumn#3(account_order_summary.first_name as firstName)",
            "key": "firstName",
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
            "id": "SqlTableColumn#4(account_order_summary.order_count as orderCount)",
            "key": "orderCount",
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
                "id": "SqlTableColumn#1(account_order_summary.account_id as accountId)",
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
                "id": "SqlTableColumn#2(account_order_summary.email)",
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
                "id": "SqlTableColumn#3(account_order_summary.first_name as firstName)",
                "key": "firstName",
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
                "id": "SqlTableColumn#4(account_order_summary.order_count as orderCount)",
                "key": "orderCount",
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
          "dialect": "sqlite",
          "format": null,
          "id": "SqlTable#7(main.account_order_summary)",
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
});

describe("fromDrizzleView (sqlite) — SQL generation", () => {
   const View = fromDrizzleView(accountOrderSummaryDrizzle, "main");

   test("SELECT all columns", () => {
      expect(sql`SELECT ${row(View.$$)} FROM ${View}`.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "aos_1"."account_id" AS "accountId",
          "aos_1"."email",
          "aos_1"."first_name" AS "firstName",
          "aos_1"."order_count" AS "orderCount"
        FROM
          "main"."account_order_summary" AS "aos_1" /* </query_0> */"
      `);
   });

   test("SELECT specific columns", () => {
      expect(
         sql`SELECT ${row(View.$accountId, View.$email, View.$orderCount)} FROM ${View}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "aos_1"."account_id" AS "accountId",
          "aos_1"."email",
          "aos_1"."order_count" AS "orderCount"
        FROM
          "main"."account_order_summary" AS "aos_1" /* </query_0> */"
      `);
   });

   test("SELECT with WHERE param", () => {
      const emailParam = param<{ email: string }>("email");
      expect(
         sql`SELECT ${row(View.$$)} FROM ${View} WHERE ${View.$email} = ${emailParam}`.getSql({ params: { email: "a@b.com" } }).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "aos_1"."account_id" AS "accountId",
          "aos_1"."email",
          "aos_1"."first_name" AS "firstName",
          "aos_1"."order_count" AS "orderCount"
        FROM
          "main"."account_order_summary" AS "aos_1"
        WHERE
          "aos_1"."email" = ? /* </query_0> */"
      `);
   });
});
