// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import "@vexnor/sqlite3";
import { Account, Order } from "@vexnor/core/testing";
import { sql, row } from "@vexnor/core";
import { Sqlite3SelectCommand } from "#src/crud/sqlite3-select-command.js";
import { defaultQueryOptions } from "#src/crud/default-query-options.js";

describe("Sqlite3SelectCommand — constructor and execute()", () => {
   test("constructor without includes produces basic query", () => {
      const command = new Sqlite3SelectCommand(Account, {});
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("execute() returns sqlite handler", () => {
      const command = new Sqlite3SelectCommand(Account, {});
      const handler = command.execute();
      expect(handler).toBeDefined();
      expect(handler.source).toBeDefined();
   });
});

describe("Sqlite3SelectCommand — createIncludes", () => {
   test("createIncludes returns null when no includeOne/includeMany", () => {
      const command = new Sqlite3SelectCommand(Account, {});
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: defaultQueryOptions });
      // No includes — should not have json_group_array
      expect(text).not.toContain("json_group_array");
   });

   test("createIncludes with includeOne produces scalar subquery", () => {
      const firstOrder = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         WHERE ${Order.$accountId} = ${Account.$accountId}
      `;
      const command = new Sqlite3SelectCommand(Account, { includeOne: { firstOrder } });
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId",
          /* <query_1> */ (
            SELECT
              json_object(
                'orderId',
                "orderId",
                'status',
                "status",
                'createdAt',
                "createdAt",
                'modifiedAt',
                "modifiedAt",
                'accountId',
                "accountId"
              )
            FROM
              (
                /* <query_2> */
                SELECT
                  "query_3".*
                FROM
                  (
                    /* <query_3> */
                    SELECT
                      "o_2"."order_id" AS "orderId",
                      "o_2"."status",
                      "o_2"."created_at" AS "createdAt",
                      "o_2"."modified_at" AS "modifiedAt",
                      "o_2"."account_id" AS "accountId"
                    FROM
                      "main"."order" AS "o_2"
                    WHERE
                      "o_2"."account_id" = "a_3"."account_id"
                      /* </query_3> */
                  ) AS "query_3"
                LIMIT
                  1 /* </query_2> */
              ) AS "query_2"
            LIMIT
              1
          ) AS "firstOrder" /* </query_1> */
        FROM
          "main"."account" AS "a_1"
          /* <query_4> */
          /* </query_4> */
          /* <query_5> */
          /* </query_5> */
          /* <query_6> */
          /* </query_6> */
          /* </query_0> */"
      `);
   });

   test("createIncludes with includeMany produces json_group_array", () => {
      const orders = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         WHERE ${Order.$accountId} = ${Account.$accountId}
      `;
      const command = new Sqlite3SelectCommand(Account, { includeMany: { orders } });
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId",
          /* <query_1> */ (
            SELECT
              coalesce(
                json_group_array(
                  json_object(
                    'orderId',
                    "orderId",
                    'status',
                    "status",
                    'createdAt',
                    "createdAt",
                    'modifiedAt',
                    "modifiedAt",
                    'accountId',
                    "accountId"
                  )
                ),
                '[]'
              )
            FROM
              (
                /* <query_2> */
                SELECT
                  "o_2"."order_id" AS "orderId",
                  "o_2"."status",
                  "o_2"."created_at" AS "createdAt",
                  "o_2"."modified_at" AS "modifiedAt",
                  "o_2"."account_id" AS "accountId"
                FROM
                  "main"."order" AS "o_2"
                WHERE
                  "o_2"."account_id" = "a_3"."account_id"
                  /* </query_2> */
              ) AS "query_2"
          ) AS "orders" /* </query_1> */
        FROM
          "main"."account" AS "a_1"
          /* <query_3> */
          /* </query_3> */
          /* <query_4> */
          /* </query_4> */
          /* <query_5> */
          /* </query_5> */
          /* </query_0> */"
      `);
   });

   test("createIncludes with both includeOne and includeMany", () => {
      const firstOrder = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         WHERE ${Order.$accountId} = ${Account.$accountId}
         LIMIT 1
      `;
      const orders = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         WHERE ${Order.$accountId} = ${Account.$accountId}
      `;
      const command = new Sqlite3SelectCommand(Account, {
         includeOne: { firstOrder },
         includeMany: { orders },
      });
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId",
          /* <query_1> */ (
            SELECT
              json_object(
                'orderId',
                "orderId",
                'status',
                "status",
                'createdAt',
                "createdAt",
                'modifiedAt',
                "modifiedAt",
                'accountId',
                "accountId"
              )
            FROM
              (
                /* <query_2> */
                SELECT
                  "query_3".*
                FROM
                  (
                    /* <query_3> */
                    SELECT
                      "o_2"."order_id" AS "orderId",
                      "o_2"."status",
                      "o_2"."created_at" AS "createdAt",
                      "o_2"."modified_at" AS "modifiedAt",
                      "o_2"."account_id" AS "accountId"
                    FROM
                      "main"."order" AS "o_2"
                    WHERE
                      "o_2"."account_id" = "a_3"."account_id"
                    LIMIT
                      1
                      /* </query_3> */
                  ) AS "query_3"
                LIMIT
                  1 /* </query_2> */
              ) AS "query_2"
            LIMIT
              1
          ) AS "firstOrder" /* </query_1> */,
          /* <query_4> */ (
            SELECT
              coalesce(
                json_group_array(
                  json_object(
                    'orderId',
                    "orderId",
                    'status',
                    "status",
                    'createdAt',
                    "createdAt",
                    'modifiedAt',
                    "modifiedAt",
                    'accountId',
                    "accountId"
                  )
                ),
                '[]'
              )
            FROM
              (
                /* <query_5> */
                SELECT
                  "o_4"."order_id" AS "orderId",
                  "o_4"."status",
                  "o_4"."created_at" AS "createdAt",
                  "o_4"."modified_at" AS "modifiedAt",
                  "o_4"."account_id" AS "accountId"
                FROM
                  "main"."order" AS "o_4"
                WHERE
                  "o_4"."account_id" = "a_5"."account_id"
                  /* </query_5> */
              ) AS "query_5"
          ) AS "orders" /* </query_4> */
        FROM
          "main"."account" AS "a_1"
          /* <query_6> */
          /* </query_6> */
          /* <query_7> */
          /* </query_7> */
          /* <query_8> */
          /* </query_8> */
          /* </query_0> */"
      `);
   });

   test("createIncludes afterFrom is always empty array for sqlite3", () => {
      const orders = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         WHERE ${Order.$accountId} = ${Account.$accountId}
      `;
      const command = new Sqlite3SelectCommand(Account, { includeMany: { orders } });
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: defaultQueryOptions });
      // SQLite3 does not use lateral joins (no afterFrom content)
      expect(text).not.toContain("LATERAL");
      expect(text).not.toContain("OUTER APPLY");
   });
});
