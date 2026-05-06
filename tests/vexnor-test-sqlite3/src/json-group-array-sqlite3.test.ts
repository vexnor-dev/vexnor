import { beforeAll, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { info, param, row, sql, SqlBuildContext } from "vexnor";
import { Order } from "./codegen/main.order-table.js";
import { Account } from "./codegen/main.account-table.js";
import { jsonMany, Sqlite3Tokenizer } from "vexnor-sqlite3";
import { db } from "./config.js";

describe("Sqlite3JsonAggregation", () => {
   let parentAccountId!: string;

   beforeAll(() => {
      parentAccountId = randomUUID();
      db.prepare(
         `INSERT INTO account (account_id, first_name, last_name, email, status) VALUES (?, 'Json', 'Test', ?, 'created')`,
      ).run(parentAccountId, `json-agg-test-${parentAccountId}@example.com`);
   });

   const AccountOrders = sql`
      ${info({ label: "AccountOrders" })}
      select ${row(Order.$orderId, Order.$status)}
      from ${Order}
      where ${Order.$accountId} = ${Account.out.$accountId}
      limit ${param<{ limit: number }>("limit")}`;

   test("should build 'select' - returns correct column in result", async () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account}
         where ${Account.$accountId} = ${parentAccountId}
      `;
      const results = await query.sqlite.all({ db, params: { limit: 5 } });
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty("orders");
   });

   const INVALID_KEYWORDS_FOR_JSON_AGG = ["where", "group by", "order by", "update", "delete from"];
   test.each(INVALID_KEYWORDS_FOR_JSON_AGG)("%s throws error", (keyword) => {
      const context = new SqlBuildContext({ tokenizer: new Sqlite3Tokenizer() });
      context.next(keyword);
      expect(() => jsonMany(AccountOrders).build(context, {})).toThrow(
         `Cannot use json aggregation with SQL keyword '${keyword}'`,
      );
   });

   test("should have 'params' - limit is respected", () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account}
         where ${Account.$accountId} = ${parentAccountId}
      `;
      const { values } = query.getSql({ params: { limit: 5 } });
      expect(values).toEqual([5, parentAccountId]);
   });
});
