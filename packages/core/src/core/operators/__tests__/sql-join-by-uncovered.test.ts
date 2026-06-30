import { describe, expect, test, beforeEach } from "vitest";
import { SqlJoinBy } from "#src/core/operators/sql-join-by.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { Account, Order, OrderItem } from "@test-models/vexnor_dev.schema.js";
import { SqlTable } from "#src/core/schema/sql-table.js";

describe("SqlJoinBy — uncovered branches", () => {
   beforeEach(() => {
      SqlTable.register(Account);
      SqlTable.register(Order);
      SqlTable.register(OrderItem);
   });

   test("throws for invalid ON operator", () => {
      const joinByOp = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: { account: { on: [["_.accountId", "INVALID", "account.accountId"]] } },
         },
      });
      expect(() => joinByOp.write(context)).toThrow("Invalid ON operator");
   });

   test("throws when ON condition column cannot be resolved", () => {
      const joinByOp = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: { account: { on: [["_.nonexistent", "=", "account.accountId"]] } },
         },
      });
      expect(() => joinByOp.write(context)).toThrow("Cannot resolve ON condition");
   });

   test("resolveColRef returns undefined for unrecognized alias", () => {
      const joinByOp = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: { account: { on: [["unknown.field", "=", "account.accountId"]] } },
         },
      });
      expect(() => joinByOp.write(context)).toThrow("Cannot resolve ON condition");
   });

   test("parseJoinByParam returns empty for invalid (non-object) param", () => {
      const joinByOp = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: { joinBy: "invalid" },
      });
      joinByOp.write(context);
      expect(context.text).toMatchInlineSnapshot(`""`);
   });

   test("parseJoinByParam skips entries with missing or non-array on field", () => {
      const joinByOp = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: { account: { on: "not-an-array" } },
         },
      });
      joinByOp.write(context);
      expect(context.text).toMatchInlineSnapshot(`""`);
   });
});
