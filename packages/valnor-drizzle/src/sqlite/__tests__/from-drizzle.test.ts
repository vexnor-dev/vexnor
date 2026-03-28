import { describe, expect, test } from "vitest";
import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";
import { sql, row, val, param, SqlTable } from "valnor";
import { fromDrizzle } from "../index.js";

const accountDrizzle = sqliteTable("account", {
   accountId: text("account_id").primaryKey(),
   email: text("email").notNull(),
   firstName: text("first_name").notNull(),
   notes: text("notes"),
   age: integer("age"),
   balance: real("balance"),
   parentId: text("parent_id"),
});

const orderDrizzle = sqliteTable("order", {
   orderId: text("order_id").primaryKey(),
   accountId: text("account_id").notNull(),
   total: integer("total"),
});

describe("fromDrizzle (sqlite) — metadata", () => {
   test("returns SqlTable instance", () => {
      expect(fromDrizzle(accountDrizzle)).toBeInstanceOf(SqlTable);
   });

   test("fromDrizzle — no schema", () => {
      expect(fromDrizzle(accountDrizzle)).toMatchInlineSnapshot(`
        SqlTable {
          "$accountId": SqlTableColumn {
            "columnName": "account_id",
            "format": null,
            "id": "SqlTableColumn#1(account.account_id as accountId)",
            "key": "accountId",
            "tableInfo": {
              "name": "account",
              "schema": null,
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$age": SqlTableColumn {
            "columnName": "age",
            "format": null,
            "id": "SqlTableColumn#5(account.age)",
            "key": "age",
            "tableInfo": {
              "name": "account",
              "schema": null,
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$balance": SqlTableColumn {
            "columnName": "balance",
            "format": null,
            "id": "SqlTableColumn#6(account.balance)",
            "key": "balance",
            "tableInfo": {
              "name": "account",
              "schema": null,
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$email": SqlTableColumn {
            "columnName": "email",
            "format": null,
            "id": "SqlTableColumn#2(account.email)",
            "key": "email",
            "tableInfo": {
              "name": "account",
              "schema": null,
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$firstName": SqlTableColumn {
            "columnName": "first_name",
            "format": null,
            "id": "SqlTableColumn#3(account.first_name as firstName)",
            "key": "firstName",
            "tableInfo": {
              "name": "account",
              "schema": null,
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$notes": SqlTableColumn {
            "columnName": "notes",
            "format": null,
            "id": "SqlTableColumn#4(account.notes)",
            "key": "notes",
            "tableInfo": {
              "name": "account",
              "schema": null,
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$parentId": SqlTableColumn {
            "columnName": "parent_id",
            "format": null,
            "id": "SqlTableColumn#7(account.parent_id as parentId)",
            "key": "parentId",
            "tableInfo": {
              "name": "account",
              "schema": null,
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
                "id": "SqlTableColumn#1(account.account_id as accountId)",
                "key": "accountId",
                "tableInfo": {
                  "name": "account",
                  "schema": null,
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$age": SqlTableColumn {
                "columnName": "age",
                "format": null,
                "id": "SqlTableColumn#5(account.age)",
                "key": "age",
                "tableInfo": {
                  "name": "account",
                  "schema": null,
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$balance": SqlTableColumn {
                "columnName": "balance",
                "format": null,
                "id": "SqlTableColumn#6(account.balance)",
                "key": "balance",
                "tableInfo": {
                  "name": "account",
                  "schema": null,
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$email": SqlTableColumn {
                "columnName": "email",
                "format": null,
                "id": "SqlTableColumn#2(account.email)",
                "key": "email",
                "tableInfo": {
                  "name": "account",
                  "schema": null,
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$firstName": SqlTableColumn {
                "columnName": "first_name",
                "format": null,
                "id": "SqlTableColumn#3(account.first_name as firstName)",
                "key": "firstName",
                "tableInfo": {
                  "name": "account",
                  "schema": null,
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$notes": SqlTableColumn {
                "columnName": "notes",
                "format": null,
                "id": "SqlTableColumn#4(account.notes)",
                "key": "notes",
                "tableInfo": {
                  "name": "account",
                  "schema": null,
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$parentId": SqlTableColumn {
                "columnName": "parent_id",
                "format": null,
                "id": "SqlTableColumn#7(account.parent_id as parentId)",
                "key": "parentId",
                "tableInfo": {
                  "name": "account",
                  "schema": null,
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
            },
            "callback": [Function],
          },
          "_crudConfig": {
            "delete": true,
            "insert": true,
            "select": true,
            "update": true,
          },
          "_out": Lazy {
            "_computed": false,
            "_value": null,
            "callback": [Function],
          },
          "dialect": "sqlite",
          "format": null,
          "id": "SqlTable#4(account)",
          "pk": [
            "accountId",
          ],
          "tableInfo": {
            "name": "account",
            "schema": null,
          },
          "tag": null,
          "type": "SqlTable",
        }
      `);
   });

   test("fromDrizzle — schema override", () => {
      const Account = fromDrizzle(accountDrizzle, "main");
      expect(Account.tableInfo.schema).toMatchInlineSnapshot(`"main"`);
   });

   test("pk — composite via primaryKey() constraint", () => {
      const orderItem = sqliteTable("order_item", {
         orderId: text("order_id").notNull(),
         productId: text("product_id").notNull(),
         quantity: integer("quantity").notNull(),
      }, (t) => [primaryKey({ columns: [t.orderId, t.productId] })]);

      expect(fromDrizzle(orderItem).pk).toMatchInlineSnapshot(`
        [
          "orderId",
          "productId",
        ]
      `);
   });
});

describe("fromDrizzle (sqlite) — SQL generation", () => {
   const Account = fromDrizzle(accountDrizzle, "main");
   const Order = fromDrizzle(orderDrizzle, "main");

   test("SELECT all columns", () => {
      expect(
         sql`SELECT ${row(Account.$$)} FROM ${Account}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."notes",
          "a_1"."age",
          "a_1"."balance",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("SELECT specific columns", () => {
      expect(
         sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("SELECT with WHERE param", () => {
      const idParam = param<{ id: string }>("id");
      expect(
         sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${idParam}`.getSql({ params: { id: "123" } }).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."notes",
          "a_1"."age",
          "a_1"."balance",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
        WHERE
          "a_1"."account_id" = ? /* </query_0> */"
      `);
   });

   test("SELECT with column alias", () => {
      expect(
         sql`SELECT ${row(Account.$firstName.as("name"))} FROM ${Account}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."first_name" AS "name"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("SELECT with aggregate val()", () => {
      expect(
         sql`SELECT ${row(Account.$accountId, val`COUNT(*)`.as<{ total: number }>("total"))} FROM ${Account} GROUP BY ${Account.$accountId}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          /* <query_1> */ COUNT(*) /* </query_1> */ AS "total"
        FROM
          "main"."account" AS "a_1"
        GROUP BY
          "a_1"."account_id" /* </query_0> */"
      `);
   });

   test("SELECT with table alias (.as())", () => {
      const Parent = Account.as("parent");
      expect(
         sql`SELECT ${row(Account.$$, Parent.$email.as("parentEmail"))} FROM ${Account} JOIN ${Parent} ON ${Parent.$accountId} = ${Account.$parentId}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."notes",
          "a_1"."age",
          "a_1"."balance",
          "a_1"."parent_id" AS "parentId",
          "parent"."email" AS "parentEmail"
        FROM
          "main"."account" AS "a_1"
          JOIN "main"."account" AS "parent" ON "parent"."account_id" = "a_1"."parent_id" /* </query_0> */"
      `);
   });

   test("SELECT with JOIN", () => {
      expect(
         sql`SELECT ${row(Account.$accountId, Order.$orderId)} FROM ${Account} JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "o_2"."order_id" AS "orderId"
        FROM
          "main"."account" AS "a_1"
          JOIN "main"."order" AS "o_2" ON "o_2"."account_id" = "a_1"."account_id" /* </query_0> */"
      `);
   });

   test("INSERT insertColsVals", () => {
      expect(
         sql`INSERT INTO ${Account} ${Account.insertColsVals({ accountId: "some-id", email: "a@b.com", firstName: "John" })} RETURNING ${row(Account.$$)}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("account_id", "email", "first_name")
        VALUES
          (?, ?, ?)
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."notes",
          "account"."age",
          "account"."balance",
          "account"."parent_id" AS "parentId" /* </query_0> */"
      `);
   });

   test("UPDATE updateSet", () => {
      expect(
         sql`UPDATE ${Account} SET ${Account.updateSet({ email: "new@b.com" })} WHERE ${Account.$accountId} = ${"some-id"}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "main"."account"
        SET
          "email" = ?
        WHERE
          "account"."account_id" = ? /* </query_0> */"
      `);
   });

   test("DELETE", () => {
      expect(
         sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${"some-id"}`.getSql({}).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        DELETE FROM "main"."account"
        WHERE
          "account"."account_id" = ? /* </query_0> */"
      `);
   });
});
