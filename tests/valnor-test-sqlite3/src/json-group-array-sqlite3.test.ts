import { describe, expect, test } from "vitest";
import { info, param, sql, SqlBuildContext } from "valnor";
import { IOrderSelect, Order } from "./codegen/main.order-table.js";
import { Account, IAccountSelect } from "./codegen/main.account-table.js";
import { jsonGroupArray, Sqlite3Tokenizer } from "valnor-sqlite3";
import "@valnor/test-utils";

describe("jsonGroupArray (SQLite)", () => {
   const AccountOrders = sql<IOrderSelect, { limit: number }>`
      ${info({ label: "AccountOrders" })}
      select ${Order.$orderId}, ${Order.$status}
      from ${Order}
      where ${Order.$accountId} = ${Account.$accountId}
      limit ${param("limit")}`;

   test("jsonGroupArray(): select", () => {
      const context = new SqlBuildContext({ tokenizer: new Sqlite3Tokenizer("test") });
      context.next("select");
      jsonGroupArray(AccountOrders).build(context, {});
      // Updated expected string to exactly match the actual output from the error message
      expect(context.text).toEqualQuery(
         `(select coalesce(json_group_array(json_object("AccountOrders".*)), '[]')
              from ( /* --label: AccountOrders */ select "o_1"."order_id" as "orderId", "o_1"."status"
                                                  from "main"."order" as "o_1"
                                                  where "o_1"."account_id" = "a_2"."account_id"
                                                  limit $limit) as "AccountOrders")`,
      );
   });

   const INVALID_KEYWORDS_FOR_JSON_AGG = ["where", "group by", "order by", "update", "delete from"];
   test.each(INVALID_KEYWORDS_FOR_JSON_AGG)("jsonGroupArray(): %s throws error", (keyword) => {
      const context = new SqlBuildContext({ tokenizer: new Sqlite3Tokenizer("test") });
      context.next(keyword);
      expect(() => jsonGroupArray(AccountOrders).build(context, {})).toThrow(
         "Cannot use jsonGroupArray() with SQL keyword:",
      );
   });

   test("jsonGroupArray() with params", () => {
      const query = sql<IAccountSelect & { orders: IOrderSelect[] }, { limit: number }>`
         select ${Account.$$}, ${jsonGroupArray(AccountOrders)} as "orders"
         from ${Account}
      `;

      expect(query.getSql({ params: { limit: 5 } }))
         .toEqualQuery(`select "a_1"."account_id"                                                as "accountId",
                               "a_1"."status",
                               "a_1"."email",
                               "a_1"."first_name"                                                as "firstName",
                               "a_1"."last_name"                                                 as "lastName",
                               "a_1"."notes",
                               "a_1"."created_at"                                                as "createdAt",
                               "a_1"."modified_at"                                               as "modifiedAt",
                               "a_1"."parent_id"                                                 as "parentId",
                               (select coalesce(json_group_array(json_object("AccountOrders".*)), '[]')
                                from ( /* --label: AccountOrders */ select "o_2"."order_id" as "orderId", "o_2"."status"
                                                                    from "main"."order" as "o_2"
                                                                    where "o_2"."account_id" = "a_1"."account_id"
                                                                    limit ?) as "AccountOrders") as "orders"
                        from "main"."account" as "a_1"`);
   });
});
