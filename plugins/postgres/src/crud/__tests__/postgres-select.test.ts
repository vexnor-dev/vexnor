// noinspection SqlNoDataSourceInspection,SqlResolve
import { assertType, describe, expect, test } from "vitest";
import { Account, Order, OrderItem, AccountStatusUdt } from "@vexnor/core/testing";
import { sql, row, col, param, input, ParamsOf, TypeOf } from "@vexnor/core";
import { jsonMany } from "#src/charms/json-aggregation-postgres.js";
import { postgresSelect } from "#src/crud/postgres-select.js";
import { defaultQueryOptions } from "#src/default-query-options.js";

describe("postgresSelect()", () => {
   test("basic select", () => {
      const query = postgresSelect(Account, {});
      const { text } = query.source.getSql({ options: defaultQueryOptions });
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

   test("basic select - has $$ and row", () => {
      const query = postgresSelect(Account, {});
      expect(query.source.$$).toBeDefined();
      expect(query.source.row).toBeDefined();
      expect(query.source.row.$accountId).toBeDefined();
   });

   test("with WHERE", () => {
      const params = input<{ id: string }>();
      const query = postgresSelect(Account, { WHERE: sql`${Account.$accountId} = ${params.$id}` });
      const { text } = query.source.getSql({ params: { id: "test-id" }, options: defaultQueryOptions });
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
        WHERE
          /* <query_2> */ "a_1"."account_id" = $1 /* </query_2> */ /* </query_1> */
          /* <query_3> */
          /* </query_3> */
          /* <query_4> */
          /* </query_4> */
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
      const { text, values } = query.source.getSql({ params: { offset: 0, limit: 10 }, options: defaultQueryOptions });
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
          /* <query_4> */
        ORDER BY
          /* <query_5> */ "a_1"."created_at" DESC /* </query_5> */ /* </query_4> */
        LIMIT
          $1
        OFFSET
          $2
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
      const { text } = query.source.getSql({ options: defaultQueryOptions });
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
          /* <query_3> */
          /* </query_3> */
          /* <query_4> */
          /* </query_4> */
          /* <query_5> */
          /* </query_5> */
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
      expect(query.source.$$).toBeDefined();
      expect(query.source.row).toBeDefined();
      expect(query.source.row.$accountId).toBeDefined();
   });

   test("with includeOne", () => {
      const firstOrder = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = postgresSelect(Account, { includeOne: { firstOrder } });
      const { text } = query.source.getSql({});
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
          /* <query_4> */
          /* </query_4> */
          /* <query_5> */
          /* </query_5> */
          /* <query_6> */
          /* </query_6> */
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
      expect(query.source.$$).toBeDefined();
      expect(query.source.row).toBeDefined();
      expect(query.source.row.$accountId).toBeDefined();
      expect(query.source.row.$firstOrder).toBeDefined();
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
      const select = postgresSelect(Account, { includeOne: { firstOrder }, includeMany: { children } });
      const { text } = select.source.getSql({ options: defaultQueryOptions });
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
          /* <query_6> */
          /* </query_6> */
          /* <query_7> */
          /* </query_7> */
          /* <query_8> */
          /* </query_8> */
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
      const select = postgresSelect(Account, { includeMany: { orders: ordersWithItems } });
      const { text } = select.source.getSql({});
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
          /* <query_5> */
          /* </query_5> */
          /* <query_6> */
          /* </query_6> */
          /* <query_7> */
          /* </query_7> */
          /* </query_0> */"
      `);
   });

   test("with SELECT override — full subquery inlines into SELECT clause", () => {
      const orderCount = col<{ orderCount: number }>("orderCount");
      const select = postgresSelect(Account, {
         SELECT: sql`${row(Account.$$)}, (select count(*) from ${Order} where ${Order.$accountId} = ${Account.$accountId}) as ${orderCount}`,
      });
      const { text } = select.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          /* <query_1> */ "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId",
          (
            SELECT
              count(*)
            FROM
              "main"."order" AS "o_2"
            WHERE
              "o_2"."account_id" = "a_1"."account_id"
          ) AS "orderCount" /* </query_1> */
        FROM
          "main"."account" AS "a_1"
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* <query_4> */
          /* </query_4> */
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

   describe("windowBy query building", () => {
      test("windowBy — ranking function (row_number)", () => {
         const query = postgresSelect(Account, {});
         const { text, values } = query.source.getSql({ params: { windowBy: { rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } } } }, options: defaultQueryOptions });
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
             row_number() OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "rowNum"
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
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("windowBy — aggregate function (sum)", () => {
         const query = postgresSelect(Account, {});
         const { text, values } = query.source.getSql({ params: { windowBy: { total: { fn: "sum", col: "createdAt", over: { partitionBy: ["status"], orderBy: { createdAt: "ASC" } } } } }, options: defaultQueryOptions });
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
             sum("a_1"."created_at") OVER (
               PARTITION BY
                 "a_1"."status"
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "total"
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
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("windowBy — offset function (lag)", () => {
         const query = postgresSelect(Account, {});
         const { text, values } = query.source.getSql({ params: { windowBy: { prev: { fn: "lag", col: "email", args: 1, over: { orderBy: { email: "ASC" } } } } }, options: defaultQueryOptions });
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
             lag("a_1"."email", 1) OVER (
               ORDER BY
                 "a_1"."email" ASC
             ) AS "prev"
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
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("windowBy — bucket function (ntile)", () => {
         const query = postgresSelect(Account, {});
         const { text, values } = query.source.getSql({ params: { windowBy: { quartile: { fn: "ntile", args: 4, over: { orderBy: { createdAt: "ASC" } } } } }, options: defaultQueryOptions });
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
             ntile(4) OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "quartile"
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
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("windowBy — frame clause", () => {
         const query = postgresSelect(Account, {});
         const { text, values } = query.source.getSql({ params: { windowBy: { moving: { fn: "avg", col: "createdAt", over: { orderBy: { createdAt: "ASC" }, frame: "rows", start: 2, end: "current row" } } } }, options: defaultQueryOptions });
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
             avg("a_1"."created_at") OVER (
               ORDER BY
                 "a_1"."created_at" ASC ROWS BETWEEN 2 preceding
                 AND current ROW
             ) AS "moving"
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
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("windowBy — multiple functions", () => {
         const query = postgresSelect(Account, {});
         const { text, values } = query.source.getSql({ params: { windowBy: { rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } }, total: { fn: "sum", col: "createdAt", over: { partitionBy: ["status"], orderBy: { createdAt: "ASC" } } } } }, options: defaultQueryOptions });
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
             row_number() OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "rowNum",
             sum("a_1"."created_at") OVER (
               PARTITION BY
                 "a_1"."status"
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "total"
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
         expect(values).toMatchInlineSnapshot(`[]`);
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
         });
      });
   });

   describe("windowBy in select() — Row type inference", () => {
      test("windowBy declared in select() adds aliases to Row type", () => {
         const query = Account.postgres.select({
            windowBy: {
               myRank: { fn: "rank", over: { orderBy: { createdAt: "ASC" } } },
               prevEmail: { fn: "lag", col: "email", args: 1, over: { orderBy: { createdAt: "ASC" } } },
            },
         });
         type Row = TypeOf<typeof query>;

         // Window aliases present with correct types
         assertType<Row["myRank"]>(1 as number);
         const _prev: Row["prevEmail"] = "" as string; // lag → string | null
         void _prev;

         // Base row fields still present
         assertType<Row["accountId"]>("" as string);
         assertType<Row["email"]>("" as string);

         // @ts-expect-error — 'notDeclared' was not in windowBy
         // eslint-disable-next-line unused-imports/no-unused-vars
         type _Bad = Row["notDeclared"];
      });

      test("without windowBy — Row is base type only", () => {
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = Account.postgres.select({});
         type Row = TypeOf<typeof query>;

         // Base row fields
         assertType<Row["accountId"]>("" as string);
         assertType<Row["email"]>("" as string);
      });

      test("select declared in select() narrows Row to projected columns", () => {
         // eslint-disable-next-line unused-imports/no-unused-vars
         const query = Account.postgres.select({
            select: {
               email: true,
               total: { fn: "count", col: "*" },
               month: { fn: "dateTrunc", col: "createdAt", args: "month" },
            },
         });
         type Row = TypeOf<typeof query>;

         // Projected fields with correct types
         assertType<Row["email"]>("" as string);
         assertType<Row["total"]>(0 as number);
         assertType<Row["month"]>("" as string);

         // @ts-expect-error — 'accountId' was not selected
         type _NoAccountId = Row["accountId"];
      });

      test("select + windowBy combined — narrowed + augmented", () => {
         const query = Account.postgres.select({
            select: { email: true, total: { fn: "count", col: "*" } },
            windowBy: { rank: { fn: "rank", over: { orderBy: { createdAt: "ASC" } } } },
         });
         type Row = TypeOf<typeof query>;

         // Selected fields
         assertType<Row["email"]>("" as string);
         assertType<Row["total"]>(0 as number);

         // Window alias
         assertType<Row["rank"]>(1 as number);

         // @ts-expect-error — 'accountId' was not selected
         type _NoAccountId = Row["accountId"];
      });
   });
});
