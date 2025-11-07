import { describe, expect, test } from "vitest";
import { SqlQueryContext } from "../sql-query-context.js";

describe("QueryContext tests", () => {
   test("QueryContext.queryName default to query_1", () => {
      const context = new SqlQueryContext({});
      expect(context.queryName).toEqual("query_0");
   });

   test("QueryContext.queryName defined to test", () => {
      const context = new SqlQueryContext({ queryName: "test" });
      expect(context.queryName).toEqual("test");
   });

   test("QueryContext.newScope().queryName default to query_1", () => {
      const context = new SqlQueryContext({});
      expect(context.scope({}).queryName).toEqual("query_1");
   });

   test("QueryContext.newScope().queryName custom to test", () => {
      const context = new SqlQueryContext({});
      expect(context.scope({ queryName: "test" }).queryName).toEqual("test");
   });

   test("SqlQueryContext.child() should not use the current keywords", () => {
      const context = new SqlQueryContext({});
      context.next("join");
      expect(context.keyword).toEqual("join");
      const actual = context.scope();
      expect(actual.keyword).toEqual("join");
      expect(Array.from(actual.keywords())).toEqual(["join"]);
   });
});
