import { beforeAll, describe, expect, test } from "vitest";
import { info, param, row, SqlBuildContext } from "valnor";
import { Account, AccountStatusUdt, IAccountSelect, Order, IOrderSelect } from "./codegen/valnor_test.schema.js";
import { jsonMany, PostgresTokenizer, sql } from "valnor-postgres";
import { pool } from "./postgres-pool.js";

describe.sequential("jsonMany() tests", () => {
   const TAG = "json-many-test";
   let parentAccount!: IAccountSelect;
   let orders!: IOrderSelect[];

   beforeAll(async () => {
      parentAccount = await sql`
         insert into ${Account}
            ${Account.insertColsVals({
               status: AccountStatusUdt.CREATED,
               firstName: "John-0-json-many",
               lastName: "Doe-0-json-many",
               email: `john.doe-${TAG}@example.com`,
            })}
            returning ${row(Account.$$)}
      `.getOneRequired({ db: pool });
      expect(parentAccount.accountId).toBeDefined();

      const childrenAccounts = await sql`
         insert into ${Account}
            ${Account.insertColsVals(
               {
                  status: AccountStatusUdt.CREATED,
                  firstName: "John-1-json-many",
                  lastName: "Doe-1-json-many",
                  email: `john.doe-1-${TAG}@example.com`,
                  parentId: parentAccount.accountId,
               },
               {
                  status: AccountStatusUdt.CREATED,
                  firstName: "John-2-json-many",
                  lastName: "Doe-2-json-many",
                  email: `john.doe-2-${TAG}@example.com`,
                  parentId: parentAccount.accountId,
               },
            )}
            returning ${row(Account.$$)}
      `.getAll({ db: pool });
      expect(childrenAccounts).toHaveLength(2);

      orders = await sql`
         insert into ${Order}
            ${Order.insertColsVals(
               { accountId: parentAccount.accountId },
               { accountId: parentAccount.accountId },
            )}
            returning ${row(Order.$$)}
      `.getAll({ db: pool });
      expect(orders).toHaveLength(2);
   });

   // Used for unit/build tests only — no outer alias needed
   const AccountOrdersUnit = sql`
      ${info({ label: "AccountOrders" })}
      select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
      from ${Order}
      where ${Order.$accountId} = ${Account.$accountId}
      order by ${Order.$createdAt} desc
      limit ${param<{ limit: number }>("limit")}`;

   // Used for E2E tests — Account.out resolves to the outer lateral alias
   const AccountOrders = sql`
      ${info({ label: "AccountOrders" })}
      select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
      from ${Order}
      where ${Order.$accountId} = ${Account.out.$accountId}
      order by ${Order.$createdAt} desc
      limit ${param<{ limit: number }>("limit")}`;

   test("jsonMany(): select", () => {
      const context = new SqlBuildContext({ tokenizer: new PostgresTokenizer("test") });
      context.next("select");
      const jsonAccountOrders = jsonMany(AccountOrdersUnit);
      jsonAccountOrders.build(context, {});
      expect(context.tokens[0]).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": ""AccountOrders_result"",
        }
      `);
   });

   const INVALID_KEYWORDS_FOR_JSON_AGG = ["where", "group by", "order by", "update", "delete from"];
   test.each(INVALID_KEYWORDS_FOR_JSON_AGG)("jsonMany(): %s throws error", (keyword) => {
      const context = new SqlBuildContext({ tokenizer: new PostgresTokenizer("test") });
      context.next(keyword);
      expect(() => jsonMany(AccountOrdersUnit).build(context, {})).toThrow(
         "Cannot use JsonAggregationPostgres with SQL keyword:",
      );
   });

   test("jsonMany(): from", () => {
      const context = new SqlBuildContext({ tokenizer: new PostgresTokenizer("test") });
      context.next("from");
      jsonMany(AccountOrdersUnit).build(context, {});
      expect(context.text).toMatchInlineSnapshot(
         `
        "/* <query_1> */
        /* inline: true */
        LEFT JOIN LATERAL (
          SELECT
            coalesce(jsonb_agg ("AccountOrders".*), '[]') AS "AccountOrders_result"
          FROM
            (
              /* <AccountOrders> */
              /* label: AccountOrders */
              SELECT
                "o_1"."order_id" AS "orderId",
                "o_1"."status",
                "o_1"."created_at" AS "createdAt",
                "o_1"."modified_at" AS "modifiedAt"
              FROM
                "valnor_test"."order" AS "o_1"
              WHERE
                "o_1"."account_id" = "a_2"."account_id"
              ORDER BY
                "o_1"."created_at" DESC
              LIMIT
                ? /* </AccountOrders> */
            ) AS "AccountOrders"
        ) AS "AccountOrders" ON TRUE
        /* </query_1> */"
      `,
      );
   });

   test("jsonMany() with params", () => {
      const AccountOrders = sql`
         ${info({ label: "AccountOrders" })}
         select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
         order by ${Order.$createdAt} desc
         limit ${param<{ limit: number }>("limit")}`;

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("children")}
         from ${Account} ${jsonMany(AccountOrders)}
         order by ${Account.$accountId}
      `;
      const target = query.query.getSql({ params: { limit: 5 } });
      expect(target.values).toEqual([5]);

      expect(target.text).toMatchInlineSnapshot(
         `
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
          "a_1"."parent_id" AS "parentId",
          "AccountOrders_result" AS "children"
        FROM
          "valnor_test"."account" AS "a_1" /* <query_2> */
          /* inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(jsonb_agg("AccountOrders".*), '[]') AS "AccountOrders_result"
            FROM
              (
                /* <AccountOrders> */
                /* label: AccountOrders */
                SELECT
                  "o_2"."order_id" AS "orderId",
                  "o_2"."status",
                  "o_2"."created_at" AS "createdAt",
                  "o_2"."modified_at" AS "modifiedAt"
                FROM
                  "valnor_test"."order" AS "o_2"
                WHERE
                  "o_2"."account_id" = "a_3"."account_id"
                ORDER BY
                  "o_2"."created_at" DESC
                LIMIT
                  ? /* </AccountOrders> */
              ) AS "AccountOrders"
          ) AS "AccountOrders" ON TRUE
          /* </query_2> */
        ORDER BY
          "a_1"."account_id"
          /* </query_0> */"
      `,
      );
   });

   test("jsonMany() with custom alias", () => {
      const AccountOrders = sql`
         ${info({ label: "AccountOrders" })}
         select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
         order by ${Order.$createdAt} desc
         limit ${param<{ limit: number }>("limit")}`;

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         order by ${Account.$accountId}
      `;

      const target = query.query.getSql({ params: { limit: 5 } });
      expect(target.values).toEqual([5]);
      expect(target.text).toMatchInlineSnapshot(
         `
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
          "a_1"."parent_id" AS "parentId",
          "AccountOrders_result" AS "orders"
        FROM
          "valnor_test"."account" AS "a_1" /* <query_2> */
          /* inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(jsonb_agg("AccountOrders".*), '[]') AS "AccountOrders_result"
            FROM
              (
                /* <AccountOrders> */
                /* label: AccountOrders */
                SELECT
                  "o_2"."order_id" AS "orderId",
                  "o_2"."status",
                  "o_2"."created_at" AS "createdAt",
                  "o_2"."modified_at" AS "modifiedAt"
                FROM
                  "valnor_test"."order" AS "o_2"
                WHERE
                  "o_2"."account_id" = "a_3"."account_id"
                ORDER BY
                  "o_2"."created_at" DESC
                LIMIT
                  ? /* </AccountOrders> */
              ) AS "AccountOrders"
          ) AS "AccountOrders" ON TRUE
          /* </query_2> */
        ORDER BY
          "a_1"."account_id"
          /* </query_0> */"
      `,
      );
   });

   test("jsonMany() E2E: returns aggregated orders for account", async () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${parentAccount.accountId}
      `;

      const results = await query.getAll({ db: pool, params: { limit: 10 } });
      expect(results).toHaveLength(1);
      expect(results[0]!.orders).toHaveLength(2);
      expect(results[0]!.orders.map((o) => o.orderId)).toEqual(
         expect.arrayContaining(orders.map((o) => o.orderId)),
      );
   });

   test("jsonMany() E2E: returns empty array when no orders", async () => {
      const accountWithNoOrders = await sql`
         insert into ${Account}
            ${Account.insertColsVals({
               status: AccountStatusUdt.CREATED,
               firstName: "No-orders",
               lastName: "Account",
               email: `no-orders-${TAG}@example.com`,
            })}
            returning ${row(Account.$$)}
      `.getOneRequired({ db: pool });

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${accountWithNoOrders.accountId}
      `;

      const results = await query.getAll({ db: pool, params: { limit: 10 } });
      expect(results).toHaveLength(1);
      expect(results[0]!.orders).toEqual([]);
   });
});
