import { describe, expect, test } from "vitest";
import { Account, Order } from "@vexnor/core/testing";
import { sql, row } from "@vexnor/core";
import { postgresSelect } from "#src/crud/postgres-select.js";
import { defaultQueryOptions } from "#src/default-query-options.js";

describe("postgresSelect — includeOne/includeMany coverage", () => {
   test("includeOne creates jsonOne charm with LATERAL join", () => {
      const firstOrder = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = postgresSelect(Account, { includeOne: { firstOrder } });
      const { text } = query.source.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
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
          "query_1_result" AS "firstOrder"
        FROM
          "main"."account" AS "a_1" /* <query_3> */
          /* inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(to_jsonb("query_1".*), NULL) AS "query_1_result"
            FROM
              (
                /* <query_1> */
                SELECT
                  "query_2".*
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
                LIMIT
                  1 /* </query_1> */
              ) AS "query_1"
          ) AS "query_1" ON TRUE
          /* </query_3> */
          /* <query_4> */
          /* </query_4> */
          /* <query_5> */
          /* </query_5> */
          /* <query_6> */
          /* </query_6> */
          /* </query_0> */"
      `);
   });

   test("includeMany creates jsonMany charm with LATERAL join", () => {
      const orders = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = postgresSelect(Account, { includeMany: { orders } });
      const { text } = query.source.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
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
          "query_1_result" AS "orders"
        FROM
          "main"."account" AS "a_1" /* <query_2> */
          /* inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(jsonb_agg("query_1".*), '[]') AS "query_1_result"
            FROM
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
              ) AS "query_1"
          ) AS "query_1" ON TRUE
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* <query_4> */
          /* </query_4> */
          /* <query_5> */
          /* </query_5> */
          /* </query_0> */"
      `);
   });

   test("includeOne and includeMany together", () => {
      const firstOrder = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const allOrders = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = postgresSelect(Account, { includeOne: { firstOrder }, includeMany: { allOrders } });
      const { text } = query.source.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
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
          "query_1_result" AS "firstOrder",
          "query_3_result" AS "allOrders"
        FROM
          "main"."account" AS "a_1" /* <query_4> */
          /* inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(to_jsonb("query_1".*), NULL) AS "query_1_result"
            FROM
              (
                /* <query_1> */
                SELECT
                  "query_2".*
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
                LIMIT
                  1 /* </query_1> */
              ) AS "query_1"
          ) AS "query_1" ON TRUE
          /* </query_4> */
          /* <query_5> */
          /* inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(jsonb_agg("query_3".*), '[]') AS "query_3_result"
            FROM
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
              ) AS "query_3"
          ) AS "query_3" ON TRUE
          /* </query_5> */
          /* <query_6> */
          /* </query_6> */
          /* <query_7> */
          /* </query_7> */
          /* <query_8> */
          /* </query_8> */
          /* </query_0> */"
      `);
   });

   test("no includes — hooks is undefined", () => {
      const query = postgresSelect(Account, {});
      const { text } = query.source.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
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
});
