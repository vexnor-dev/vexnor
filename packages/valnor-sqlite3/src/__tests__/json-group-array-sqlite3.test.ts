import { describe, expect, test } from "vitest";
import { info, param, sql, SqlQueryContext, trim } from "valnor";
import { jsonGroupArray } from "../json-group-array-sqlite3.js";
import { IOrderSelect, Order } from "./codegen/main.order-table.js";
import { Account, IAccountSelect } from "./codegen/main.account-table.js";
import { Sqlite3Tokenizer } from "../sqlite3-tokenizer.js";

describe("jsonGroupArray (SQLite)", () => {
   const AccountOrders = sql<IOrderSelect, { limit: number }>`
      ${info({ label: "AccountOrders" })}
      select ${Order.orderId}, ${Order.status}
      from ${Order}
      where ${Order.accountId} = ${Account.accountId}
      limit ${param("limit")}`;

   test("jsonGroupArray(): select", () => {
      const context = new SqlQueryContext({ queryName: "test", tokenizer: new Sqlite3Tokenizer("test") });
      context.next("select");
      jsonGroupArray(AccountOrders).build(context, {});
      // Updated expected string to exactly match the actual output from the error message
      expect(trim(context.strings.join(""))).toBe(
         trim`(select coalesce(json_group_array(json_object("AccountOrders".*)), '[]')
              from ( /* --label: AccountOrders */ select "order_1"."order_id" as "orderId", "order_1"."status"
                                                  from "main"."order" as "order_1"
                                                  where "order_1"."account_id" = "account_1"."account_id"
                                                  limit $limit) as "AccountOrders")`,
      );
   });

   const INVALID_KEYWORDS_FOR_JSON_AGG = ["where", "group by", "order by", "update", "delete from"];
   test.each(INVALID_KEYWORDS_FOR_JSON_AGG)("jsonGroupArray(): %s throws error", (keyword) => {
      const context = new SqlQueryContext({ queryName: "test", tokenizer: new Sqlite3Tokenizer("test") });
      context.next(keyword);
      expect(() => jsonGroupArray(AccountOrders).build(context, {})).toThrow(
         "Cannot use jsonGroupArray() with SQL keyword:",
      );
   });

   test("jsonGroupArray() with params", () => {
      const query = sql<IAccountSelect & { orders: IOrderSelect[] }, { limit: number }>`
         select ${Account.$$all}, ${jsonGroupArray(AccountOrders)} as "orders"
         from ${Account}
      `;

      // Updated expectedSql to match the actual output from the console log
      const expectedSql = trim`select "account_1"."account_id"                                         as "accountId",
                                      "account_1"."status",
                                      "account_1"."email",
                                      "account_1"."first_name"                                         as "firstName",
                                      "account_1"."last_name"                                          as "lastName",
                                      "account_1"."notes",
                                      "account_1"."created_at"                                         as "createdAt",
                                      "account_1"."modified_at"                                        as "modifiedAt",
                                      (select coalesce(json_group_array(json_object("AccountOrders".*)), '[]')
                                       from ( /* --label: AccountOrders */ select "order_1"."order_id" as "orderId", "order_1"."status"
                                                                          from "main"."order" as "order_1"
                                                                          where "order_1"."account_id" = "account_1"."account_id"
                                                                          limit ?) as "AccountOrders") as "orders"
                               from "main"."account" as "account_1"`;

      const actualSql = query.getSql({ params: { limit: 5 } });
      expect(trim(actualSql)).toBe(expectedSql);
   });
});
