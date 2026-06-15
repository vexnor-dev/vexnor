import { describe, expect, test } from "vitest";
import { mssqlTable, mssqlSchema, varchar, nvarchar, int, bit, primaryKey } from "drizzle-orm/mssql-core";
import { sql, row, val, param, SqlTable } from "@vexnor/core";
import { fromDrizzleTable } from "../index.js";

const accountDrizzle = mssqlTable("account", {
   accountId: varchar("account_id", { length: 36 }).primaryKey(),
   email: varchar("email", { length: 255 }).notNull(),
   firstName: nvarchar("first_name", { length: 100 }).notNull(),
   notes: nvarchar("notes", { length: "max" }),
   age: int("age"),
   active: bit("active"),
   parentId: varchar("parent_id", { length: 36 }),
});

const orderDrizzle = mssqlTable("order", {
   orderId: varchar("order_id", { length: 36 }).primaryKey(),
   accountId: varchar("account_id", { length: 36 }).notNull(),
   total: int("total"),
});

const mySchema = mssqlSchema("vexnor_dev");
const accountSchemaDrizzle = mySchema.table("account", {
   accountId: varchar("account_id", { length: 36 }).primaryKey(),
   email: varchar("email", { length: 255 }).notNull(),
   firstName: nvarchar("first_name", { length: 100 }).notNull(),
   parentId: varchar("parent_id", { length: 36 }),
});

describe("fromDrizzleTable (mssql) — metadata", () => {
   test("returns SqlTable instance", () => {
      expect(fromDrizzleTable(accountDrizzle)).toBeInstanceOf(SqlTable);
   });

   test("fromDrizzleTable — no schema", () => {
      expect(fromDrizzleTable(accountDrizzle)).toMatchInlineSnapshot(`
        SqlTable {
          "$accountId": SqlTableColumn {
            "columnName": "account_id",
            "format": null,
            "hashId": "SqlTableColumn#(account.account_id as accountId)",
            "id": "SqlTableColumn#1(account.account_id as accountId)",
            "jsonType": null,
            "key": "accountId",
            "tableInfo": {
              "name": "account",
              "schema": null,
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$active": SqlTableColumn {
            "columnName": "active",
            "format": null,
            "hashId": "SqlTableColumn#(account.active)",
            "id": "SqlTableColumn#6(account.active)",
            "jsonType": null,
            "key": "active",
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
            "hashId": "SqlTableColumn#(account.age)",
            "id": "SqlTableColumn#5(account.age)",
            "jsonType": null,
            "key": "age",
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
            "hashId": "SqlTableColumn#(account.email)",
            "id": "SqlTableColumn#2(account.email)",
            "jsonType": null,
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
            "hashId": "SqlTableColumn#(account.first_name as firstName)",
            "id": "SqlTableColumn#3(account.first_name as firstName)",
            "jsonType": null,
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
            "hashId": "SqlTableColumn#(account.notes)",
            "id": "SqlTableColumn#4(account.notes)",
            "jsonType": null,
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
            "hashId": "SqlTableColumn#(account.parent_id as parentId)",
            "id": "SqlTableColumn#7(account.parent_id as parentId)",
            "jsonType": null,
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
                "hashId": "SqlTableColumn#(account.account_id as accountId)",
                "id": "SqlTableColumn#1(account.account_id as accountId)",
                "jsonType": null,
                "key": "accountId",
                "tableInfo": {
                  "name": "account",
                  "schema": null,
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$active": SqlTableColumn {
                "columnName": "active",
                "format": null,
                "hashId": "SqlTableColumn#(account.active)",
                "id": "SqlTableColumn#6(account.active)",
                "jsonType": null,
                "key": "active",
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
                "hashId": "SqlTableColumn#(account.age)",
                "id": "SqlTableColumn#5(account.age)",
                "jsonType": null,
                "key": "age",
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
                "hashId": "SqlTableColumn#(account.email)",
                "id": "SqlTableColumn#2(account.email)",
                "jsonType": null,
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
                "hashId": "SqlTableColumn#(account.first_name as firstName)",
                "id": "SqlTableColumn#3(account.first_name as firstName)",
                "jsonType": null,
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
                "hashId": "SqlTableColumn#(account.notes)",
                "id": "SqlTableColumn#4(account.notes)",
                "jsonType": null,
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
                "hashId": "SqlTableColumn#(account.parent_id as parentId)",
                "id": "SqlTableColumn#7(account.parent_id as parentId)",
                "jsonType": null,
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
          "columnTypes": {},
          "dbSchema": {},
          "dialect": "tsql",
          "fk": [],
          "format": null,
          "hashId": "SqlTable#(account)",
          "id": "SqlTable#4(account)",
          "pk": [
            "accountId",
          ],
          "source": "",
          "tableInfo": {
            "name": "account",
            "schema": null,
          },
          "tag": null,
          "type": "SqlTable",
        }
      `);
   });

   test("fromDrizzleTable — schema from mssqlSchema", () => {
      expect(fromDrizzleTable(accountSchemaDrizzle)).toMatchInlineSnapshot(`
        SqlTable {
          "$accountId": SqlTableColumn {
            "columnName": "account_id",
            "format": null,
            "hashId": "SqlTableColumn#(account.account_id as accountId)",
            "id": "SqlTableColumn#8(account.account_id as accountId)",
            "jsonType": null,
            "key": "accountId",
            "tableInfo": {
              "name": "account",
              "schema": "vexnor_dev",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$email": SqlTableColumn {
            "columnName": "email",
            "format": null,
            "hashId": "SqlTableColumn#(account.email)",
            "id": "SqlTableColumn#9(account.email)",
            "jsonType": null,
            "key": "email",
            "tableInfo": {
              "name": "account",
              "schema": "vexnor_dev",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$firstName": SqlTableColumn {
            "columnName": "first_name",
            "format": null,
            "hashId": "SqlTableColumn#(account.first_name as firstName)",
            "id": "SqlTableColumn#10(account.first_name as firstName)",
            "jsonType": null,
            "key": "firstName",
            "tableInfo": {
              "name": "account",
              "schema": "vexnor_dev",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$parentId": SqlTableColumn {
            "columnName": "parent_id",
            "format": null,
            "hashId": "SqlTableColumn#(account.parent_id as parentId)",
            "id": "SqlTableColumn#11(account.parent_id as parentId)",
            "jsonType": null,
            "key": "parentId",
            "tableInfo": {
              "name": "account",
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
                "hashId": "SqlTableColumn#(account.account_id as accountId)",
                "id": "SqlTableColumn#8(account.account_id as accountId)",
                "jsonType": null,
                "key": "accountId",
                "tableInfo": {
                  "name": "account",
                  "schema": "vexnor_dev",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$email": SqlTableColumn {
                "columnName": "email",
                "format": null,
                "hashId": "SqlTableColumn#(account.email)",
                "id": "SqlTableColumn#9(account.email)",
                "jsonType": null,
                "key": "email",
                "tableInfo": {
                  "name": "account",
                  "schema": "vexnor_dev",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$firstName": SqlTableColumn {
                "columnName": "first_name",
                "format": null,
                "hashId": "SqlTableColumn#(account.first_name as firstName)",
                "id": "SqlTableColumn#10(account.first_name as firstName)",
                "jsonType": null,
                "key": "firstName",
                "tableInfo": {
                  "name": "account",
                  "schema": "vexnor_dev",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$parentId": SqlTableColumn {
                "columnName": "parent_id",
                "format": null,
                "hashId": "SqlTableColumn#(account.parent_id as parentId)",
                "id": "SqlTableColumn#11(account.parent_id as parentId)",
                "jsonType": null,
                "key": "parentId",
                "tableInfo": {
                  "name": "account",
                  "schema": "vexnor_dev",
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
          "columnTypes": {},
          "dbSchema": {},
          "dialect": "tsql",
          "fk": [],
          "format": null,
          "hashId": "SqlTable#(vexnor_dev.account)",
          "id": "SqlTable#5(vexnor_dev.account)",
          "pk": [
            "accountId",
          ],
          "source": "",
          "tableInfo": {
            "name": "account",
            "schema": "vexnor_dev",
          },
          "tag": null,
          "type": "SqlTable",
        }
      `);
   });

   test("fromDrizzleTable — schema override", () => {
      const Account = fromDrizzleTable(accountDrizzle, "dbo");
      expect(Account.tableInfo.schema).toMatchInlineSnapshot(`"dbo"`);
   });

   test("pk — composite via primaryKey() constraint", () => {
      const orderItem = mssqlTable(
         "order_item",
         {
            orderId: varchar("order_id", { length: 36 }).notNull(),
            productId: varchar("product_id", { length: 36 }).notNull(),
            quantity: int("quantity").notNull(),
         },
         (t) => [primaryKey({ columns: [t.orderId, t.productId] })],
      );

      expect(fromDrizzleTable(orderItem).pk).toMatchInlineSnapshot(`
        [
          "orderId",
          "productId",
        ]
      `);
   });
});

describe("fromDrizzleTable (mssql) — SQL generation", () => {
   const Account = fromDrizzleTable(accountSchemaDrizzle);
   const Order = fromDrizzleTable(orderDrizzle, "vexnor_dev");

   test("SELECT all columns", () => {
      expect(sql`SELECT ${row(Account.$$)} FROM ${Account}`.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."parent_id" AS "parentId"
        FROM
          "vexnor_dev"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("SELECT specific columns", () => {
      expect(sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`.getSql({}).text)
         .toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email"
        FROM
          "vexnor_dev"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("SELECT with WHERE param", () => {
      const idParam = param<{ id: string }>("id");
      expect(
         sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${idParam}`.getSql({
            params: { id: "123" },
         }).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."parent_id" AS "parentId"
        FROM
          "vexnor_dev"."account" AS "a_1"
        WHERE
          "a_1"."account_id" = @param_0 /* </query_0> */"
      `);
   });

   test("SELECT with column alias", () => {
      expect(sql`SELECT ${row(Account.$firstName.as("name"))} FROM ${Account}`.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."first_name" AS "name"
        FROM
          "vexnor_dev"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("SELECT with aggregate val()", () => {
      expect(
         sql`SELECT ${row(Account.$accountId, val`COUNT(*)`.as<{ total: number }>("total"))} FROM ${Account} GROUP BY ${Account.$accountId}`.getSql(
            {},
         ).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          /* <query_1> */ COUNT(*) /* </query_1> */ AS "total"
        FROM
          "vexnor_dev"."account" AS "a_1"
        GROUP BY
          "a_1"."account_id" /* </query_0> */"
      `);
   });

   test("SELECT with table alias (.as())", () => {
      const Parent = Account.as("parent");
      expect(
         sql`SELECT ${row(Account.$$, Parent.$email.as("parentEmail"))} FROM ${Account} JOIN ${Parent} ON ${Parent.$accountId} = ${Account.$parentId}`.getSql(
            {},
         ).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."parent_id" AS "parentId",
          "parent"."email" AS "parentEmail"
        FROM
          "vexnor_dev"."account" AS "a_1"
          JOIN "vexnor_dev"."account" AS "parent" ON "parent"."account_id" = "a_1"."parent_id" /* </query_0> */"
      `);
   });

   test("SELECT with JOIN", () => {
      expect(
         sql`SELECT ${row(Account.$accountId, Order.$orderId)} FROM ${Account} JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}`.getSql(
            {},
         ).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "o_2"."order_id" AS "orderId"
        FROM
          "vexnor_dev"."account" AS "a_1"
          JOIN "vexnor_dev"."order" AS "o_2" ON "o_2"."account_id" = "a_1"."account_id" /* </query_0> */"
      `);
   });

   test("INSERT insertColsVals", () => {
      expect(
         sql`INSERT INTO ${Account} ${Account.insertColsVals({ accountId: "some-id", email: "a@b.com", firstName: "John" })} RETURNING ${row(Account.$$)}`.getSql(
            {},
         ).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "vexnor_dev"."account" ("account_id", "email", "first_name")
        VALUES
          (@param_0, @param_1, @param_2) RETURNING "account"."account_id" AS "accountId",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."parent_id" AS "parentId" /* </query_0> */"
      `);
   });

   test("UPDATE updateSet", () => {
      expect(
         sql`UPDATE ${Account} SET ${Account.updateSet({ email: "new@b.com" })} WHERE ${Account.$accountId} = ${"some-id"}`.getSql(
            {},
         ).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "vexnor_dev"."account"
        SET
          "email" = @param_0
        WHERE
          "account"."account_id" = @param_1 /* </query_0> */"
      `);
   });

   test("DELETE", () => {
      expect(sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${"some-id"}`.getSql({}).text)
         .toMatchInlineSnapshot(`
        "/* <query_0> */
        DELETE FROM "vexnor_dev"."account"
        WHERE
          "account"."account_id" = @param_0 /* </query_0> */"
      `);
   });
});
