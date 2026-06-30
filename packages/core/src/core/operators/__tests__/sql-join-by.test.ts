import { describe, expect, test, beforeEach } from "vitest";
import { Account, Order, OrderItem } from "@test-models/vexnor_dev.schema.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlJoinBy, joinBy } from "#src/core/operators/sql-join-by.js";
import { SqlTable, newSqlTable } from "#src/core/schema/sql-table.js";

describe("SqlJoinBy", () => {
   beforeEach(() => {
      SqlTable.register(Account);
      SqlTable.register(Order);
      SqlTable.register(OrderItem);
   });
   test("emits nothing when joinBy param is absent", () => {
      const joinBy = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({ dialect: "sqlite", params: {} });
      joinBy.write(context);
      expect(context.text).toBe("");
      expect(context.getColumn("test")).toBeUndefined();
   });

   test("emits nothing when joinBy param is null", () => {
      const joinBy = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({ dialect: "sqlite", params: { joinBy: null } });
      joinBy.write(context);
      expect(context.text).toBe("");
      expect(context.getColumn("test")).toBeUndefined();
   });

   test("emits nothing when joinBy param is empty object", () => {
      const joinBy = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({ dialect: "sqlite", params: { joinBy: {} } });
      joinBy.write(context);
      expect(context.text).toBe("");
      expect(context.columnCount).toBe(0);
   });

   test("emits JOIN clause for single table", () => {
      const joinBy = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
         },
      });
      joinBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`"JOIN "main"."account" ON "o_1"."account_id" = "a_2"."account_id""`);
   });

   test("emits chained JOINs for multiple tables", () => {
      const joinBy = new SqlJoinBy(OrderItem, "joinBy", undefined, { order: Order, account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: {
               order: { on: [["_.orderId", "=", "order.orderId"]] },
               account: { on: [["order.accountId", "=", "account.accountId"]] },
            },
         },
      });
      joinBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "JOIN "main"."order" ON "oi_1"."order_id" = "o_2"."order_id"
        JOIN "main"."account" ON "o_2"."account_id" = "a_3"."account_id""
      `);
   });

   test("populates columnMap with all joined table columns", () => {
      const joinBy = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
         },
      });
      joinBy.write(context);
      expect(context.columnCount).toBeGreaterThan(0);
      expect(context.getColumn("account.email")).toBeDefined();
      expect(context.getColumn("account.firstName")).toBeDefined();
   });

   test("emits LEFT JOIN when type is specified", () => {
      const joinBy = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]], type: "left" } },
         },
      });
      joinBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`"LEFT JOIN "main"."account" ON "o_1"."account_id" = "a_2"."account_id""`);
   });

   test("throws when table not found in registry", () => {
      const joinBy = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: { nonexistent: { on: [["_.orderId", "=", "nonexistent.id"]] } },
         },
      });
      expect(() => joinBy.write(context)).toThrow('[joinBy] Table "nonexistent" not found in registry');
   });

   test("throws when column not found", () => {
      const joinBy = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: { account: { on: [["_.nonexistentCol", "=", "account.accountId"]] } },
         },
      });
      expect(() => joinBy.write(context)).toThrow("Cannot resolve ON condition");
   });

   test("serialization mode emits joinBy operator token", () => {
      const joinBy = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({ dialect: "sqlite", params: null });
      joinBy.write(context);
      const opToken = context.tokens.find((t) => t.type === "operator");
      expect(opToken).toMatchInlineSnapshot(`
        {
          "operator": {
            "joinMap": {
              "account": {
                "columns": {
                  "accountId": ""a_1"."account_id"",
                  "createdAt": ""a_1"."created_at"",
                  "email": ""a_1"."email"",
                  "firstName": ""a_1"."first_name"",
                  "lastName": ""a_1"."last_name"",
                  "modifiedAt": ""a_1"."modified_at"",
                  "notes": ""a_1"."notes"",
                  "parentId": ""a_1"."parent_id"",
                  "status": ""a_1"."status"",
                },
                "schema": "main",
                "table": "account",
              },
            },
            "joinTypes": {},
            "param": "joinBy",
            "type": "joinBy",
          },
          "type": "operator",
        }
      `);
   });

   test("resolves bare column name (no dot prefix) in ON condition", () => {
      const joinByOp = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: { account: { on: [["accountId", "=", "account.accountId"]] } },
         },
      });
      joinByOp.write(context);
      expect(context.text).toMatchInlineSnapshot(`"JOIN "main"."account" ON "o_1"."account_id" = "a_2"."account_id""`);
   });

   test("resolves cross-schema table reference", () => {
      const otherAccount = newSqlTable<{ Select: { accountId: string; email: string }; Insert: { accountId?: string; email: string }; Update: { accountId?: string; email?: string }; Delete: true }>({
         tableInfo: { name: "account", schema: "otherSchema", out: false, alias: null },
         pk: ["accountId"],
         source: "@vexnor/test:models",
         fk: [],
         columns: { accountId: "account_id", email: "email" },
         crud: { select: true, insert: true, update: true, delete: true },
      });

      const joinByOp = new SqlJoinBy(Order, "joinBy", undefined, { otherAccount });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: { otherAccount: { on: [["_.accountId", "=", "otherAccount.accountId"]] } },
         },
      });
      joinByOp.write(context);
      expect(context.text).toMatchInlineSnapshot(`"JOIN "otherSchema"."account" ON "o_1"."account_id" = "a_2"."account_id""`);
   });

   test("joinBy() factory creates instance with default param name", () => {
      const instance = joinBy(Order);
      expect(instance.paramName).toBe("joinBy");
      expect(instance.table).toBe(Order);
   });

   test("throws when bare column name not found in any table", () => {
      const joinByOp = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            joinBy: { account: { on: [["nonExistentCol", "=", "account.accountId"]] } },
         },
      });
      expect(() => joinByOp.write(context)).toThrow("[joinBy] Cannot resolve ON condition");
   });

   test("joinBy() factory accepts custom param name", () => {
      const instance = joinBy(Order, "customJoin");
      expect(instance.paramName).toBe("customJoin");
   });
});
