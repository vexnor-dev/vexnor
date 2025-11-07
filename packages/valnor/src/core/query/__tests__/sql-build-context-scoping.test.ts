import { describe, expect, test } from "vitest";
import { SqlBuildContext } from "../sql-build-context.js";

describe("SqlBuildContext tests", () => {
   test("SqlBuildContext.queryName default to query_1", () => {
      const context = new SqlBuildContext({});
      expect(context.queryName).toEqual("query_0");
   });

   test("SqlBuildContext.queryName defined to test", () => {
      const context = new SqlBuildContext({ queryName: "test" });
      expect(context.queryName).toEqual("test");
   });

   test("SqlBuildContext.newScope().queryName default to query_1", () => {
      const context = new SqlBuildContext({});
      expect(context.scope({}).queryName).toEqual("query_1");
   });

   test("SqlBuildContext.scope().queryName custom to test", () => {
      const context = new SqlBuildContext({});
      expect(context.scope({ queryName: "test" }).queryName).toEqual("test");
      expect(context.queryName).toEqual("query_0");
   });

   test("SqlBuildContext.child() should not use the current keywords", () => {
      const context = new SqlBuildContext({});
      context.next("join");
      expect(context.keyword).toEqual("join");
      const actual = context.scope();
      expect(actual.keyword).toEqual("join");
      expect(Array.from(actual.keywords())).toEqual(["join"]);
   });
});
