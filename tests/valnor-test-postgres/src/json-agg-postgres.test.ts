import { describe, expect, test } from "vitest";
import { info, param, row, sql, SqlBuildContext } from "valnor";
import { Account, Order } from "./codegen/valnor_test.schema.js";
import { jsonAgg, PostgresTokenizer } from "valnor-postgres";
import "@valnor/test-utils";

describe("sql plugin jsonAgg() tests", () => {
   const AccountOrders = sql`
      ${info({ label: "AccountOrders" })}
      select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
      from ${Order}
      where ${Order.$accountId} = ${Account.$accountId}
      order by ${Order.$createdAt} desc
      limit ${param("limit").number}`;

   test("jsonAgg(): select", () => {
      const context = new SqlBuildContext({ queryName: "test", tokenizer: new PostgresTokenizer("test") });
      context.next("select");
      jsonAgg(AccountOrders).build(context, {});
      expect(context.strings[0]).toBe(`"AccountOrders_result"`);
   });

   const INVALID_KEYWORDS_FOR_JSON_AGG = ["where", "group by", "order by", "update", "delete from"];
   test.each(INVALID_KEYWORDS_FOR_JSON_AGG)("jsonAgg(): %s throws error", (keyword) => {
      const context = new SqlBuildContext({ queryName: "test", tokenizer: new PostgresTokenizer("test") });
      context.next(keyword);
      expect(() => jsonAgg(AccountOrders).build(context, {})).toThrow("Cannot use jsonAgg() with SQL keyword:");
   });

   test("jsonAgg(): from", () => {
      const context = new SqlBuildContext({ queryName: "test", tokenizer: new PostgresTokenizer("test") });
      context.next("from");
      jsonAgg(AccountOrders).build(context, {});
      expect(context.text).toEqualQuery(
         `
            left join lateral (
               select coalesce(jsonb_agg("AccountOrders".*), '[]') as "AccountOrders_result"
               from ( /* --label: AccountOrders */
                       select "o_1"."order_id"   as "orderId",
                              "o_1"."status",
                              "o_1"."created_at" as "createdAt",
                              "o_1"."modified_at" as "modifiedAt"
                       from "valnor_test"."order" as "o_1"
                       where "o_1"."account_id" = "a_2"."account_id"
                       order by "o_1"."created_at" desc
                       limit $limit) as "AccountOrders") as "AccountOrders" on true
         `,
      );
   });

   test("jsonAgg() with params", () => {
      const AccountOrders = sql`
         ${info({ label: "AccountOrders" })}
         select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
         order by ${Order.$createdAt} desc
         limit ${param.number("limit")}`;

      const query = sql`
         select ${row(Account.$$all)}, ${jsonAgg(AccountOrders)} as "orders"
         from ${Account} ${jsonAgg(AccountOrders)}
         order by ${Account.$accountId}
      `;

      expect(query.getSql({ params: { limit: 5 } })).toEqualQuery(
         `select 
                     "a_1"."account_id"  as "accountId",
                     "a_1"."status",
                     "a_1"."email",
                     "a_1"."first_name"  as "firstName",
                     "a_1"."last_name"   as "lastName",
                     "a_1"."notes",
                     "a_1"."created_at"  as "createdAt",
                     "a_1"."modified_at" as "modifiedAt",
                     "a_1"."parent_id" as "parentId",        
                     "AccountOrders_result"  as "orders"
              from "valnor_test"."account" as "a_1"
                      left join lateral (
                 select coalesce(jsonb_agg("AccountOrders".*), '[]') as "AccountOrders_result"
                 from (
                         /* --label: AccountOrders */
                         select "o_2"."order_id"    as "orderId",
                                "o_2"."status",
                                "o_2"."created_at"  as "createdAt",
                                "o_2"."modified_at" as "modifiedAt"
                         from "valnor_test"."order" as "o_2"
                         where "o_2"."account_id" = "a_1"."account_id"
                         order by "o_2"."created_at" desc
                         limit ?) as "AccountOrders") as "AccountOrders" on true
              order by "a_1"."account_id" asc`,
      );
   });

   test("jsonAgg() with custom alias", () => {
      const AccountOrders = sql`
         ${info({ label: "AccountOrders" })}
         select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
         order by ${Order.$createdAt} desc
         limit ${param.number("limit")}`;

      const query = sql`
         select ${row(Account.$$all)}, ${jsonAgg(AccountOrders)} as "orders"
         from ${Account} ${jsonAgg(AccountOrders)}
         order by ${Account.$accountId}
      `;

      expect(query.getSql({ params: { limit: 5 } })).toEqualQuery(
         `select "a_1"."account_id"     as "accountId",
                     "a_1"."status",
                     "a_1"."email",
                     "a_1"."first_name"     as "firstName",
                     "a_1"."last_name"      as "lastName",
                     "a_1"."notes",
                     "a_1"."created_at"     as "createdAt",
                     "a_1"."modified_at"    as "modifiedAt",
                     "a_1"."parent_id"      as "parentId",
                     "AccountOrders_result" as "orders"
              from "valnor_test"."account" as "a_1"
                      left join lateral (
                 select coalesce(jsonb_agg("AccountOrders".*), '[]') as "AccountOrders_result"
                 from (
                         /* --label: AccountOrders */
                         select "o_2"."order_id"    as "orderId",
                                "o_2"."status",
                                "o_2"."created_at"  as "createdAt",
                                "o_2"."modified_at" as "modifiedAt"
                         from "valnor_test"."order" as "o_2"
                         where "o_2"."account_id" = "a_1"."account_id"
                         order by "o_2"."created_at" desc
                         limit ?) as "AccountOrders") as "AccountOrders" on true
              order by "a_1"."account_id" asc`,
      );
   });
});
