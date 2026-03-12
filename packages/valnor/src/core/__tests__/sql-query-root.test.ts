import { describe, expect, test } from "vitest";

import { randomUUID } from "node:crypto";
import { param } from "#/core/query/sql-param.js";
import { rowType } from "#/core/query/sql-row-type.js";
import { row } from "#/core/query/sql-select-row.js";
import { sql } from "#/core/sql.js";
import { Account, IAccountSelect } from "@test-models/valnor_test.account-table.js";
import { IOrderItemSelect, OrderItem } from "@test-models/valnor_test.order_item-table.js";
import { Order } from "@test-models/valnor_test.order-table.js";

describe("sql() tests", () => {
   test("sql() select", () => {
      const names = ["One", "Two", "Three"];
      const query = sql`
         ${rowType<IAccountSelect>()}
         select ${Account.$firstName}, min(${Account.$email}), ${Account.$email.as("user_email")}, ${Account.$createdAt}
         from ${Account}
         where ${Account.$email} = ${param<{ email: string }>("email")}
           and ${Account.$firstName} in (${param<{ names: string[] }>("names")})
         group by ${Account.$email}`;
      const { values, text } = query.getSql({ params: { names, email: "test@example.com" } });
      expect(values).toMatchObject(["test@example.com", "One", "Two", "Three"]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."first_name" AS "firstName",
          min("a_1"."email"),
          "a_1"."email" AS "user_email",
          "a_1"."created_at" AS "createdAt"
        FROM
          "main"."account" AS "a_1"
        WHERE
          "a_1"."email" = ?
          AND "a_1"."first_name" IN (?, ?, ?)
        GROUP BY
          "a_1"."email" /* </query_0> */"
      `);
   });

   test("sql() without any values", () => {
      const query = sql`
         select ${row(Account.$firstName, Account.$lastName)}
         from ${Account}
         where ${Account.$email} = 'bob@example.com'`;

      const { values, text } = query.getSql({});
      expect(values).toEqual([]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName"
        FROM
          "main"."account" AS "a_1"
        WHERE
          "a_1"."email" = 'bob@example.com' /* </query_0> */"
      `);
   });

   test("sql() with value as param", () => {
      const email = "bob@example.com";
      const query = sql`
        ${rowType<IAccountSelect>()}
         select ${Account.$firstName}
         from ${Account}
         where ${Account.$email} = ${email}`;
      const { values, text } = query.getSql({});
      expect(values).toEqual(["bob@example.com"]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."first_name" AS "firstName"
        FROM
          "main"."account" AS "a_1"
        WHERE
          "a_1"."email" = ? /* </query_0> */"
      `);
   });

   test("sql query with joins", () => {
      const query = sql`
        ${rowType<IOrderItemSelect>()}
         select ${OrderItem.$productId},
                ${OrderItem.$orderId},
                ${OrderItem.$productPrice},
                ${Order.$createdAt},
                ${Order.$status},
                ${Account.$firstName},
                ${Account.$lastName}
         from ${OrderItem}
                 join ${Order} on ${OrderItem.$orderId} = ${Order.$orderId}
                 join ${Account} on ${Account.$accountId} = ${Order.$accountId}`;

      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "oi_1"."product_id" AS "productId",
          "oi_1"."order_id" AS "orderId",
          "oi_1"."product_price" AS "productPrice",
          "o_2"."created_at" AS "createdAt",
          "o_2"."status",
          "a_3"."first_name" AS "firstName",
          "a_3"."last_name" AS "lastName"
        FROM
          "main"."order_item" AS "oi_1"
          JOIN "main"."order" AS "o_2" ON "oi_1"."order_id" = "o_2"."order_id"
          JOIN "main"."account" AS "a_3" ON "a_3"."account_id" = "o_2"."account_id" /* </query_0> */"
      `);
   });

   test("sql query with self-join and explicit alias", () => {
      const query = sql`
        ${rowType<IAccountSelect & { parentEmail: string }>()}
         select ${Account.$email},
                ${Account.as`parent`.$email.as("parentEmail")}
         from ${Account}
                 join ${Account.as`parent`} on ${Account.$parentId} = ${Account.as`parent`.$accountId}`;

      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."email",
          "parent"."email" AS "parentEmail"
        FROM
          "main"."account" AS "a_1"
          JOIN "main"."account" AS "parent" ON "a_1"."parent_id" = "parent"."account_id" /* </query_0> */"
      `);
   });

   test("sql() insert statement should not have an alias on the target table", () => {
      const query = sql`
         insert into ${Account} (${Account.$email}, ${Account.$firstName})
         values ('test@example.com', 'Test')`;

      const { text } = query.getSql({});
      // Note: T-SQL and PostgreSQL do not support aliases on the target table of an INSERT statement.
      // The table format for "insert into" is "schema.tableName", which correctly omits the alias.
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("email", "first_name")
        VALUES
          ('test@example.com', 'Test') /* </query_0> */"
      `);
   });

   test("sql() update statement should not have an alias on the target table or its columns", () => {
      const query = sql`
         update ${Account}
         set ${Account.$firstName} = 'Bob'
         where ${Account.$accountId} = '123'`;

      const { text } = query.getSql({});
      // For a simple UPDATE, T-SQL and PG do not alias the target table.
      // Therefore, columns in SET and WHERE clauses for that table must also be un-aliased.
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "main"."account"
        SET
          "first_name" = 'Bob'
        WHERE
          "account"."account_id" = '123' /* </query_0> */"
      `);
   });

   test("sql() complex update statement with join should use aliases", () => {
      // This pattern is common in T-SQL. The target table is aliased in the FROM clause.
      const query = sql`
         update ${Account}
         set ${Account.$firstName} = 'Staged Name'
         from ${Account}
                 join ${Order} on ${Account.$accountId} = ${Order.$accountId}
         where ${Order.$status} = 'completed'`;

      const { text } = query.getSql({});
      // In a complex UPDATE, the target table is aliased, and all column references must be qualified.
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "main"."account"
        SET
          "first_name" = 'Staged Name'
        FROM
          "main"."account"
          JOIN "main"."order" AS "o_1" ON "account"."account_id" = "o_1"."account_id"
        WHERE
          "o_1"."status" = 'completed' /* </query_0> */"
      `);
   });

   test("sql delete from", () => {
      const noid = randomUUID();
      const query = sql`
         delete
         from ${Account}
         where ${Account.$accountId} <> ${noid}`;

      const { text, values } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        DELETE FROM "main"."account"
        WHERE
          "account"."account_id" <> ? /* </query_0> */"
      `);
      expect(values).toEqual([noid]);
   });
});
