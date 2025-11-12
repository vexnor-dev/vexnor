import { describe, expect, test } from "vitest";
import { SqlBuildContext } from "../sql-build-context.js";
import { sql } from "../../sql.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { OrderItem } from "@test-models/valnor_test.order_item-table.js";
import { row } from "../sql-select-row.js";
import { SqlBuildError } from "../../sql-build-error.js";
import { ok } from "assert";

describe("SqlBuildContext scope tests", () => {
   test("SqlBuildContext should track all query tokens", () => {
      const query = sql`
         select ${row(Account.$$all)}
         from ${Account}
      `;

      const context = new SqlBuildContext({
         query,
      });

      expect(context.queriesBySqlId.get(Account.$$all.ID)).toBeUndefined();
      expect(context.queriesBySqlId.get(query.ROW.ID)).toEqual(query);
      expect(context.queriesBySqlId.get(query.ROW.$$all.ID)).toEqual(query);
      expect(context.queriesBySqlId.get(query.ROW!.$accountId!.ID)).toEqual(query);
      expect(() => context.queryName(Account)).toThrowError(SqlBuildError);
      expect(context.queryName(query.ROW)).toEqual("query_0");
      ok(query.ROW);
      expect(context.queryName(query.ROW.$$all)).toEqual("query_0");
      ok(query.ROW!.$accountId);
      expect(context.queryName(query.ROW!.$accountId)).toEqual("query_0");
   });

   test("SqlBuildContext should track all query tree tokens", () => {
      const accountOrders = sql`
        select ${row(OrderItem.$$all)}
        from ${OrderItem}
        where ${OrderItem.$createdAt} > ${Date.parse("2025-01-01")}`;

      const query = sql`
         select ${Account.$$all}
         from ${Account}
         join ${accountOrders} on ${accountOrders.ROW.$accountId} = ${Account.$accountId}
      `;

      const context = new SqlBuildContext({
         query,
      });

      expect(context.queryName(accountOrders.ROW)).toEqual("query_1");
      expect(context.queryName(accountOrders.ROW.$$all)).toEqual("query_1");
      ok(accountOrders.ROW.$accountId);
      expect(context.queryName(accountOrders.ROW.$accountId)).toEqual("query_1");
   });

   //
   // test("SqlBuildContext.queryName defined to test", () => {
   //    expect(context.queryName()).toEqual("test");
   // });
   //
   // test("SqlBuildContext.newScope().queryName default to query_1", () => {
   //    const context = new SqlBuildContext({});
   //    expect(context.scope({}).queryName).toEqual("query_1");
   // });
   //
   // test("SqlBuildContext.scope().queryName custom to test", () => {
   //    const context = new SqlBuildContext({});
   //    expect(context.scope({ query }).queryName).toEqual("test");
   //    expect(context.queryName).toEqual("query_0");
   // });
   //
   // test("SqlBuildContext.child() should not use the current keywords", () => {
   //    const context = new SqlBuildContext({});
   //    context.next("join");
   //    expect(context.keyword).toEqual("join");
   //    const actual = context.scope();
   //    expect(actual.keyword).toEqual("join");
   //    expect(Array.from(actual.keywords())).toEqual(["join"]);
   // });
});
