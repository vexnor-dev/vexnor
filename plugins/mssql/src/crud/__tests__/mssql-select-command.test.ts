// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import "@vexnor/mssql";
import { Account, Order } from "@vexnor/core/testing";
import { sql, row } from "@vexnor/core";
import { MssqlSelectCommand } from "#src/crud/mssql-select-command.js";
import { defaultQueryOptions } from "#src/default-query-options.js";

describe("MssqlSelectCommand — constructor and execute()", () => {
   test("constructor without includes produces basic query", () => {
      const command = new MssqlSelectCommand(Account, {});
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
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

   test("execute() returns mssql handler", () => {
      const command = new MssqlSelectCommand(Account, {});
      const handler = command.execute();
      expect(handler).toBeDefined();
      expect(handler.source).toBeDefined();
   });

   test("createPaginationNode uses MssqlPagination (OFFSET/FETCH)", () => {
      const command = new MssqlSelectCommand(Account, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { limit: 10, offset: 5 },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
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
        ORDER BY
          (
            SELECT
              NULL
          )
        OFFSET
          @param_0 rows
        FETCH NEXT
          @param_1 rows only
          /* </query_0> */"
      `);
   });
});

describe("MssqlSelectCommand — createIncludes", () => {
   test("createIncludes returns null when no includeOne/includeMany", () => {
      const command = new MssqlSelectCommand(Account, {});
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: defaultQueryOptions });
      // No includes — should not have OUTER APPLY
      expect(text).not.toContain("OUTER APPLY");
   });

   test("createIncludes with includeOne produces OUTER APPLY", () => {
      const firstOrder = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         WHERE ${Order.$accountId} = ${Account.$accountId}
      `;
      const command = new MssqlSelectCommand(Account, { includeOne: { firstOrder } });
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
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
          "query_1_result"."query_1" AS "firstOrder"
        FROM
          "main"."account" AS "a_1" /* <query_3> */
          OUTER APPLY (
            SELECT
              coalesce(
                (
                  /* <query_1> */
                  SELECT
                    TOP 1 "query_2".*
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
                    ) AS "query_2" /* </query_1> */
                  FOR JSON
                    path,
                    WITHOUT_ARRAY_WRAPPER,
                    include_null_values
                ),
                NULL
              ) AS "query_1"
          ) AS "query_1_result" /* </query_3> */
          /* <query_4> */
          /* </query_4> */
          /* <query_5> */
          /* </query_5> */
          /* <query_6> */
          /* </query_6> */
          /* </query_0> */"
      `);
   });

   test("createIncludes with includeMany produces OUTER APPLY", () => {
      const orders = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         WHERE ${Order.$accountId} = ${Account.$accountId}
      `;
      const command = new MssqlSelectCommand(Account, { includeMany: { orders } });
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
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
          "query_1_result"."query_1" AS "orders"
        FROM
          "main"."account" AS "a_1" /* <query_2> */
          OUTER APPLY (
            SELECT
              coalesce(
                (
                  /* <query_1> */
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
                    /* </query_1> */
                  FOR JSON
                    path,
                    include_null_values
                ),
                '[]'
              ) AS "query_1"
          ) AS "query_1_result" /* </query_2> */
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
      const command = new MssqlSelectCommand(Account, {
         includeOne: { firstOrder },
         includeMany: { orders },
      });
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
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
          "query_1_result"."query_1" AS "firstOrder",
          "query_3_result"."query_3" AS "orders"
        FROM
          "main"."account" AS "a_1" /* <query_4> */
          OUTER APPLY (
            SELECT
              coalesce(
                (
                  /* <query_1> */
                  SELECT
                    TOP 1 "query_2".*
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
                        "o_2"."account_id" = "a_3"."account_id" LIMIT 1
                        /* </query_2> */
                    ) AS "query_2" /* </query_1> */
                  FOR JSON
                    path,
                    WITHOUT_ARRAY_WRAPPER,
                    include_null_values
                ),
                NULL
              ) AS "query_1"
          ) AS "query_1_result" /* </query_4> */ /* <query_5> */
          OUTER APPLY (
            SELECT
              coalesce(
                (
                  /* <query_3> */
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
                    /* </query_3> */
                  FOR JSON
                    path,
                    include_null_values
                ),
                '[]'
              ) AS "query_3"
          ) AS "query_3_result" /* </query_5> */
          /* <query_6> */
          /* </query_6> */
          /* <query_7> */
          /* </query_7> */
          /* <query_8> */
          /* </query_8> */
          /* </query_0> */"
      `);
   });
});
