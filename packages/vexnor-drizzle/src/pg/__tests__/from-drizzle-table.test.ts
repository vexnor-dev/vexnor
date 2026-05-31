import { describe, expect, test } from "vitest";
import { pgTable, pgSchema, uuid, varchar, text, timestamp, integer, boolean, primaryKey } from "drizzle-orm/pg-core";
import { sql, row, val, param, SqlTable } from "vexnor";
import { fromDrizzleTable } from "../index.js";

const accountDrizzle = pgTable("account", {
   accountId: uuid("account_id").primaryKey().defaultRandom(),
   email: varchar("email").notNull(),
   firstName: varchar("first_name").notNull(),
   notes: text("notes"),
   createdAt: timestamp("created_at").defaultNow(),
   age: integer("age"),
   active: boolean("active"),
   parentId: uuid("parent_id"),
});

const orderDrizzle = pgTable("order", {
   orderId: uuid("order_id").primaryKey().defaultRandom(),
   accountId: uuid("account_id").notNull(),
   total: integer("total"),
});

const mySchema = pgSchema("vexnor_dev");
const accountSchemaDrizzle = mySchema.table("account", {
   accountId: uuid("account_id").primaryKey().defaultRandom(),
   email: varchar("email").notNull(),
   firstName: varchar("first_name").notNull(),
   parentId: uuid("parent_id"),
});

describe("fromDrizzleTable (pg) — metadata", () => {
   test("returns SqlTable instance", () => {
      expect(fromDrizzleTable(accountDrizzle)).toBeInstanceOf(SqlTable);
   });

   test("fromDrizzleTable — no schema", () => {
      expect(fromDrizzleTable(accountDrizzle)).toMatchInlineSnapshot(`
        SqlTable {
          "$accountId": SqlTableColumn {
            "columnName": "account_id",
            "format": null,
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
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
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
            "id": "SqlTableColumn#7(account.active)",
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
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
            "id": "SqlTableColumn#6(account.age)",
            "jsonType": null,
            "key": "age",
            "tableInfo": {
              "name": "account",
              "schema": null,
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$createdAt": SqlTableColumn {
            "columnName": "created_at",
            "format": null,
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
            "id": "SqlTableColumn#5(account.created_at as createdAt)",
            "jsonType": null,
            "key": "createdAt",
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
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
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
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
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
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
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
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
            "id": "SqlTableColumn#8(account.parent_id as parentId)",
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
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
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
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
                "id": "SqlTableColumn#7(account.active)",
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
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
                "id": "SqlTableColumn#6(account.age)",
                "jsonType": null,
                "key": "age",
                "tableInfo": {
                  "name": "account",
                  "schema": null,
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$createdAt": SqlTableColumn {
                "columnName": "created_at",
                "format": null,
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
                "id": "SqlTableColumn#5(account.created_at as createdAt)",
                "jsonType": null,
                "key": "createdAt",
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
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
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
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
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
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
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
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
                "id": "SqlTableColumn#8(account.parent_id as parentId)",
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
          "dialect": "postgresql",
          "format": null,
          "hashIdLazy": Lazy {
            "_computed": false,
            "_value": null,
            "callback": [Function],
          },
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

   test("fromDrizzleTable — schema from pgSchema", () => {
      expect(fromDrizzleTable(accountSchemaDrizzle)).toMatchInlineSnapshot(`
        SqlTable {
          "$accountId": SqlTableColumn {
            "columnName": "account_id",
            "format": null,
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
            "id": "SqlTableColumn#9(account.account_id as accountId)",
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
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
            "id": "SqlTableColumn#10(account.email)",
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
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
            "id": "SqlTableColumn#11(account.first_name as firstName)",
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
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
            "id": "SqlTableColumn#12(account.parent_id as parentId)",
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
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
                "id": "SqlTableColumn#9(account.account_id as accountId)",
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
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
                "id": "SqlTableColumn#10(account.email)",
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
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
                "id": "SqlTableColumn#11(account.first_name as firstName)",
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
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
                "id": "SqlTableColumn#12(account.parent_id as parentId)",
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
          "dialect": "postgresql",
          "format": null,
          "hashIdLazy": Lazy {
            "_computed": false,
            "_value": null,
            "callback": [Function],
          },
          "id": "SqlTable#5(vexnor_dev.account)",
          "pk": [
            "accountId",
          ],
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
      const Account = fromDrizzleTable(accountDrizzle, "public");
      expect(Account.tableInfo.schema).toMatchInlineSnapshot(`"public"`);
   });

   test("pk — composite via primaryKey() constraint", () => {
      const orderItem = pgTable(
         "order_item",
         {
            orderId: uuid("order_id").notNull(),
            productId: uuid("product_id").notNull(),
            quantity: integer("quantity").notNull(),
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

describe("fromDrizzleTable (pg) — SQL generation", () => {
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
          "a_1"."account_id" = $1 /* </query_0> */"
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
         sql`INSERT INTO ${Account} ${Account.insertColsVals({ email: "a@b.com", firstName: "John" })} RETURNING ${row(Account.$$)}`.getSql(
            {},
         ).text,
      ).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "vexnor_dev"."account" ("email", "first_name")
        VALUES
          ($1, $2)
        RETURNING
          "account"."account_id" AS "accountId",
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
          "email" = $1
        WHERE
          "account"."account_id" = $2 /* </query_0> */"
      `);
   });

   test("DELETE", () => {
      expect(sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${"some-id"}`.getSql({}).text)
         .toMatchInlineSnapshot(`
        "/* <query_0> */
        DELETE FROM "vexnor_dev"."account"
        WHERE
          "account"."account_id" = $1 /* </query_0> */"
      `);
   });
});
