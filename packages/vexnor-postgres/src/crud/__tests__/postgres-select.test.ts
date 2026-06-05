import { assertType, describe, expect, test } from "vitest";
import { Account, Order, OrderItem, AccountStatusUdt } from "vexnor/testing";
import { sql, row, col, param, input, ParamsOf, TypeOf } from "vexnor";
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
          "main"."account" AS "a_1" /* <query_3> */
          /* inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(to_jsonb ("query_1".*), NULL) AS "query_1_result"
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
          "query_3_result" AS "children"
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
                  /* </query_3> */
              ) AS "query_3"
          ) AS "query_3" ON TRUE
          /* </query_5> */
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

   test("with SELECT override — full subquery inlines into SELECT clause", () => {
      const orderCount = col<{ orderCount: number }>("orderCount");
      const query = postgresSelect(Account, {
         SELECT: sql`${row(Account.$$)}, (select count(*) from ${Order} where ${Order.$accountId} = ${Account.$accountId}) as ${orderCount}`,
      });
      const { text } = query.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          (
            /* <query_1> */ "a_1"."account_id",
            "a_1"."status",
            "a_1"."email",
            "a_1"."first_name",
            "a_1"."last_name",
            "a_1"."notes",
            "a_1"."created_at",
            "a_1"."modified_at",
            "a_1"."parent_id",
            (
              SELECT
                count(*)
              FROM
                "main"."order" AS "o_2"
              WHERE
                "o_2"."account_id" = "a_1"."account_id"
            ) AS "orderCount" /* </query_1> */
          ) AS "query_1"
        FROM
          "main"."account" AS "a_3"
          /* </query_0> */"
      `);
   });

   describe("row type inference", () => {
      test("SELECT override with row(Account.$$) + col produces base columns plus extra in result row", () => {
         const orderCount = col<{ orderCount: number }>("orderCount");
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = postgresSelect(Account, {
            SELECT: sql`${row(Account.$$)}, (select count(*) from orders) as ${orderCount}`,
         });
         type Row = TypeOf<typeof query>;
         assertType<Row>({
            accountId: "",
            email: "",
            firstName: "",
            lastName: "",
            status: AccountStatusUdt.CREATED,
            notes: null,
            createdAt: new Date(),
            modifiedAt: new Date(),
            parentId: null,
            orderCount: 0,
            // @ts-expect-error not in result
            other: "",
         });
      });

      test("SELECT + includeOne + includeMany row type includes all three contributions", () => {
         const orderCount = col<{ orderCount: number }>("orderCount");
         const firstOrder = sql`
            select ${row(Order.$$)}
            from ${Order}
            where ${Order.$accountId} = ${Account.out.$accountId}
         `;
         const children = sql`
            select ${row(Account.as("children").$$)}
            from ${Account.as("children")}
            where ${Account.as("children").$parentId} = ${Account.$accountId}
         `;
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = postgresSelect(Account, {
            SELECT: sql`${row(Account.$$)}, (select count(*) from orders) as ${orderCount}`,
            includeOne: { firstOrder },
            includeMany: { children },
         });
         type Row = TypeOf<typeof query>;
         assertType<Row>({
            accountId: "",
            email: "",
            firstName: "",
            lastName: "",
            status: AccountStatusUdt.CREATED,
            notes: null,
            createdAt: new Date(),
            modifiedAt: new Date(),
            parentId: null,
            orderCount: 0,
            firstOrder: null,
            children: [],
            // @ts-expect-error not in result
            other: "",
         });
      });
   });

   describe("param propagation through SqlSelectArgs clauses", () => {
      const emailParam = param<{ email: string }>("email");
      const dirParam = param<{ dir: string }>("dir");
      const limitParam = param<{ limit: number }>("limit");

      test("param in includeMany subquery propagates to ParamsOf query", () => {
         const orders = sql`
            select ${row(Order.$$)}
            from ${Order}
            where ${Order.$accountId} = ${Account.out.$accountId}
            limit ${limitParam}
         `;
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = postgresSelect(Account, {
            WHERE: sql`${Account.$email} = ${emailParam}`,
            ORDER_BY: sql`${Account.$createdAt} ${dirParam}`,
            includeMany: { orders },
         });
         type Params = ParamsOf<typeof query>;
         assertType<Params>({
            email: "a@b.com",
            dir: "desc",
            limit: 5,
            // @ts-expect-error not declared
            other: "x",
         });
      });

      test("param in includeOne subquery propagates to ParamsOf query", () => {
         const lastOrder = sql`
            select ${row(Order.$$)}
            from ${Order}
            where ${Order.$accountId} = ${Account.out.$accountId}
            limit ${limitParam}
         `;
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = postgresSelect(Account, {
            WHERE: sql`${Account.$email} = ${emailParam}`,
            ORDER_BY: sql`${Account.$createdAt} ${dirParam}`,
            includeOne: { lastOrder },
         });
         type Params = ParamsOf<typeof query>;
         assertType<Params>({
            email: "a@b.com",
            dir: "desc",
            limit: 1,
            // @ts-expect-error not declared
            other: "x",
         });
      });
   });
});
