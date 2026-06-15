import { describe, expect, test } from "vitest";
import { pgSchema, pgView, uuid, varchar, integer } from "drizzle-orm/pg-core";
import { sql, row, param, SqlTable } from "vexnor";
import { fromDrizzleView } from "../index.js";

const mySchema = pgSchema("vexnor_dev");

const accountOrderSummaryDrizzle = mySchema
   .view("account_order_summary", {
      accountId: uuid("account_id"),
      email: varchar("email"),
      firstName: varchar("first_name"),
      orderCount: integer("order_count"),
   })
   .existing();

const noSchemaDrizzle = pgView("account_order_summary", {
   accountId: uuid("account_id"),
   email: varchar("email"),
}).existing();

describe("fromDrizzleView (pg) — metadata", () => {
   test("throws if called with a builder instead of .existing()", () => {
      const builder = pgSchema("vexnor_dev").view("test", { id: uuid("id") });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => fromDrizzleView(builder as any)).toThrow("Call .existing() or .as");
   });

   test("returns SqlTable instance", () => {
      expect(fromDrizzleView(accountOrderSummaryDrizzle)).toBeInstanceOf(SqlTable);
   });

   test("fromDrizzleView — with schema", () => {
      expect(fromDrizzleView(accountOrderSummaryDrizzle)).toMatchInlineSnapshot(`
        SqlTable {
          "$accountId": SqlTableColumn {
            "columnName": "account_id",
            "format": null,
            "hashId": "SqlTableColumn#(account_order_summary.account_id as accountId)",
            "id": "SqlTableColumn#1(account_order_summary.account_id as accountId)",
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
            "id": "SqlTableColumn#2(account_order_summary.email)",
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
            "id": "SqlTableColumn#3(account_order_summary.first_name as firstName)",
            "jsonType": null,
            "key": "firstName",
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
            "id": "SqlTableColumn#4(account_order_summary.order_count as orderCount)",
            "jsonType": null,
            "key": "orderCount",
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
                "id": "SqlTableColumn#1(account_order_summary.account_id as accountId)",
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
                "id": "SqlTableColumn#2(account_order_summary.email)",
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
                "id": "SqlTableColumn#3(account_order_summary.first_name as firstName)",
                "jsonType": null,
                "key": "firstName",
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
                "id": "SqlTableColumn#4(account_order_summary.order_count as orderCount)",
                "jsonType": null,
                "key": "orderCount",
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
          "columnTypes": {},
          "dialect": "postgresql",
          "format": null,
          "hashId": "SqlTable#(vexnor_dev.account_order_summary)",
          "id": "SqlTable#3(vexnor_dev.account_order_summary)",
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

   test("fromDrizzleView — no schema", () => {
      expect(fromDrizzleView(noSchemaDrizzle).tableInfo.schema).toMatchInlineSnapshot(`null`);
   });

   test("fromDrizzleView — schema override", () => {
      expect(fromDrizzleView(noSchemaDrizzle, "public").tableInfo.schema).toMatchInlineSnapshot(`"public"`);
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

   test("dialect", () => {
      expect(fromDrizzleView(accountOrderSummaryDrizzle).dialect).toMatchInlineSnapshot(`"postgresql"`);
   });
});

describe("fromDrizzleView (pg) — SQL generation", () => {
   const View = fromDrizzleView(accountOrderSummaryDrizzle);

   test("SELECT all columns", () => {
      expect(sql`SELECT ${row(View.$$)} FROM ${View}`.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "aos_1"."account_id" AS "accountId",
          "aos_1"."email",
          "aos_1"."first_name" AS "firstName",
          "aos_1"."order_count" AS "orderCount"
        FROM
          "vexnor_dev"."account_order_summary" AS "aos_1" /* </query_0> */"
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
          "vexnor_dev"."account_order_summary" AS "aos_1" /* </query_0> */"
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
          "vexnor_dev"."account_order_summary" AS "aos_1"
        WHERE
          "aos_1"."email" = $1 /* </query_0> */"
      `);
   });
});
