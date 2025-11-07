import { describe, expect, test } from "vitest";
import { SqlQueryContext } from "../sql-query-context.js";

describe("Query Context alias tests", () => {
   test("'account' should alias 'a_1'", () => {
      const ctx = new SqlQueryContext({
         queryName: "test",
      });
      const actual = ctx.alias({ name: "account", schema: "valnor_test" });
      expect(actual).toBe("a_1");
   });

   test("'account' should alias 'a_1', 'order' should alias 'o_2'", () => {
      const ctx = new SqlQueryContext({
         queryName: "test",
      });
      const account = ctx.alias({ name: "account", schema: "valnor_test" });
      const order = ctx.alias({ name: "order", schema: "valnor_test" });
      expect(account).toBe("a_1");
      expect(order).toBe("o_2");
   });

   test("'order_item' should alias 'oi_1'", () => {
      const ctx = new SqlQueryContext({
         queryName: "test",
      });
      const actual = ctx.alias({ name: "order_item", schema: "valnor_test" });
      expect(actual).toBe("oi_1");
   });

   test("'account' should alias 'a_1', 'order' should alias 'o_2', 'account' should alias 'a_1'", () => {
      const ctx = new SqlQueryContext({
         queryName: "test",
      });
      const account1 = ctx.alias({ name: "account", schema: "valnor_test" });
      const order = ctx.alias({ name: "order", schema: "valnor_test" });
      const account2 = ctx.alias({ name: "account", schema: "valnor_test" });
      expect(account1).toBe("a_1");
      expect(order).toBe("o_2");
      expect(account2).toBe("a_1");
   });

   test("'account' with known alias 'parent' should alias 'parent'", () => {
      const ctx = new SqlQueryContext({
         queryName: "test",
      });
      const actual = ctx.alias({ name: "account", schema: "valnor_test", alias: "parent" });
      expect(actual).toBe("parent");
   });
});
