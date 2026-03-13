import { describe, expect, test } from "vitest";
import { Account, Order, OrderItem } from "valnor/testing";
import { sql, row, param, input } from "valnor";
import { jsonMany } from "#/charms/json-aggregation-postgres.js";
import { postgresSelect } from "#/crud/postgres-select.js";
import { defaultQueryOptions } from "#/default-query-options.js";

describe("postgresSelect()", () => {
   test("basic select", () => {
      const query = postgresSelect(Account, {});
      const { text } = query.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
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
          /* </query_0> */"
      `);
   });

   test("basic select - has $$ and row", () => {
      const query = postgresSelect(Account, {});
      expect(query.$$).toBeDefined();
      expect(query.row).toBeDefined();
      expect(query.row.$accountId).toBeDefined();
   });

   test("with WHERE", () => {
      const params = input<{ id: string }>();
      const query = postgresSelect(Account, { WHERE: sql`${Account.$accountId} = ${params.$id}` });
      const { text } = query.getSql({ params: { id: "test-id" }, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
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
        WHERE
          /* <query_2> */ "a_1"."account_id" = $1 /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
   });

   test("with ORDER_BY + offset + limit", () => {
      const offsetParam = param<{ offset: number }>("offset");
      const limitParam = param<{ limit: number }>("limit");
      const query = postgresSelect(Account, {
         ORDER_BY: sql`${Account.$createdAt} desc`,
         offset: offsetParam,
         limit: limitParam,
      });
      const { text, values } = query.getSql({ params: { offset: 0, limit: 10 }, options: defaultQueryOptions });
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
        ORDER BY
          /* <query_2> */ "a_1"."created_at" DESC /* </query_2> */ /* </query_1> */
          /* <query_3> */
        LIMIT
          $1 /* </query_3> */
          /* <query_4> */
        OFFSET
          $2 /* </query_4> */
          /* </query_0> */"
      `);
      expect(values).toMatchObject([10, 0]);
   });

   test("with includeMany", () => {
      const children = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.$accountId}
      `;
      const query = postgresSelect(Account, { includeMany: { children } });
      const { text } = query.getSql({ options: defaultQueryOptions });
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
          "query_1_result" AS "children"
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
                  "children"."account_id" AS "accountId",
                  "children"."status",
                  "children"."email",
                  "children"."first_name" AS "firstName",
                  "children"."last_name" AS "lastName",
                  "children"."notes",
                  "children"."created_at" AS "createdAt",
                  "children"."modified_at" AS "modifiedAt",
                  "children"."parent_id" AS "parentId"
                FROM
                  "main"."account" AS "children"
                WHERE
                  "children"."parent_id" = "a_2"."account_id"
                  /* </query_1> */
              ) AS "query_1"
          ) AS "query_1" ON TRUE
          /* </query_2> */
          /* </query_0> */"
      `);
   });

   test("with includeMany - has $$ and row with charm key", () => {
      const children = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.$accountId}
      `;
      const query = postgresSelect(Account, { includeMany: { children } });
      expect(query.$$).toBeDefined();
      expect(query.row).toBeDefined();
      expect(query.row.$accountId).toBeDefined();
   });

   test("with includeOne", () => {
      const firstOrder = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = postgresSelect(Account, { includeOne: { firstOrder } });
      const { text } = query.getSql({});
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
          "main"."account" AS "a_1" /* <query_2> */
          /* inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(to_jsonb ("query_1".*), NULL) AS "query_1_result"
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
          /* </query_0> */"
      `);
   });

   test("with includeOne - has $$ and row with charm key", () => {
      const firstOrder = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = postgresSelect(Account, { includeOne: { firstOrder } });
      expect(query.$$).toBeDefined();
      expect(query.row).toBeDefined();
      expect(query.row.$accountId).toBeDefined();
      expect(query.row.$firstOrder).toBeDefined();
   });

   test("with includeOne + includeMany combined", () => {
      const firstOrder = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const children = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.$accountId}
      `;
      const query = postgresSelect(Account, { includeOne: { firstOrder }, includeMany: { children } });
      const { text } = query.getSql({ options: defaultQueryOptions });
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
          "query_2_result" AS "children"
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
          /* </query_3> */
          /* <query_4> */
          /* inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(jsonb_agg("query_2".*), '[]') AS "query_2_result"
            FROM
              (
                /* <query_2> */
                SELECT
                  "children"."account_id" AS "accountId",
                  "children"."status",
                  "children"."email",
                  "children"."first_name" AS "firstName",
                  "children"."last_name" AS "lastName",
                  "children"."notes",
                  "children"."created_at" AS "createdAt",
                  "children"."modified_at" AS "modifiedAt",
                  "children"."parent_id" AS "parentId"
                FROM
                  "main"."account" AS "children"
                WHERE
                  "children"."parent_id" = "a_4"."account_id"
                  /* </query_2> */
              ) AS "query_2"
          ) AS "query_2" ON TRUE
          /* </query_4> */
          /* </query_0> */"
      `);
   });

   test("multi-level hierarchy (account -> orders -> orderItems)", () => {
      const orderItems = sql`
         select ${row(OrderItem.$$)}
         from ${OrderItem}
         where ${OrderItem.$orderId} = ${Order.$orderId}
      `;
      const ordersWithItems = sql`
         select ${row(Order.$$)}, ${jsonMany(orderItems).as("items")}
         from ${Order} ${jsonMany(orderItems)}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = postgresSelect(Account, { includeMany: { orders: ordersWithItems } });
      const { text } = query.getSql({});
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
              coalesce(jsonb_agg ("query_1".*), '[]') AS "query_1_result"
            FROM
              (
                /* <query_1> */
                SELECT
                  "o_2"."order_id" AS "orderId",
                  "o_2"."status",
                  "o_2"."created_at" AS "createdAt",
                  "o_2"."modified_at" AS "modifiedAt",
                  "o_2"."account_id" AS "accountId",
                  "query_3_result" AS "items"
                FROM
                  "main"."order" AS "o_2" /* <query_4> */
                  /* inline: true */
                  LEFT JOIN LATERAL (
                    SELECT
                      coalesce(jsonb_agg ("query_3".*), '[]') AS "query_3_result"
                    FROM
                      (
                        /* <query_3> */
                        SELECT
                          "oi_3"."product_price" AS "productPrice",
                          "oi_3"."order_item_id" AS "orderItemId",
                          "oi_3"."quantity",
                          "oi_3"."discount_price" AS "discountPrice",
                          "oi_3"."modified_at" AS "modifiedAt",
                          "oi_3"."created_at" AS "createdAt",
                          "oi_3"."order_id" AS "orderId",
                          "oi_3"."product_id" AS "productId"
                        FROM
                          "main"."order_item" AS "oi_3"
                        WHERE
                          "oi_3"."order_id" = "o_4"."order_id"
                          /* </query_3> */
                      ) AS "query_3"
                  ) AS "query_3" ON TRUE
                  /* </query_4> */
                WHERE
                  "o_2"."account_id" = "a_5"."account_id"
                  /* </query_1> */
              ) AS "query_1"
          ) AS "query_1" ON TRUE
          /* </query_2> */
          /* </query_0> */"
      `);
   });
});
