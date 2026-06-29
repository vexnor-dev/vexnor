import { describe, expect, test, beforeEach } from "vitest";
import { Account, Order } from "@test-models/vexnor_dev.schema.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlJoinBy } from "#src/core/operators/sql-join-by.js";
import { SqlTable } from "#src/core/schema/sql-table.js";

describe("SqlJoinBy — injection vectors (now blocked)", () => {
   beforeEach(() => {
      SqlTable.register(Account);
      SqlTable.register(Order);
   });

   describe("P0: op (operator) validated at runtime — rejects injection", () => {
      test("malicious op value throws", () => {
         const join = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
         const context = new SqlBuildContext({
            dialect: "sqlite",
            params: {
               joinBy: {
                  account: {
                     on: [["_.accountId", "= 1; DROP TABLE users; --", "account.accountId"]],
                  },
               },
            },
         });
         expect(() => join.write(context)).toThrow("Invalid ON operator");
      });

      test("op with SQL comment injection throws", () => {
         const join = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
         const context = new SqlBuildContext({
            dialect: "sqlite",
            params: {
               joinBy: {
                  account: {
                     on: [["_.accountId", "= 1 /*", "account.accountId"]],
                  },
               },
            },
         });
         expect(() => join.write(context)).toThrow("Invalid ON operator");
      });

      test("op with UNION SELECT injection throws", () => {
         const join = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
         const context = new SqlBuildContext({
            dialect: "sqlite",
            params: {
               joinBy: {
                  account: {
                     on: [["_.accountId", "= 1 UNION SELECT * FROM secrets --", "account.accountId"]],
                  },
               },
            },
         });
         expect(() => join.write(context)).toThrow("Invalid ON operator");
      });
   });

   describe("P0: type (join type) validated at runtime — rejects injection", () => {
      test("malicious join type throws", () => {
         const join = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
         const context = new SqlBuildContext({
            dialect: "sqlite",
            params: {
               joinBy: {
                  account: {
                     on: [["_.accountId", "=", "account.accountId"]],
                     type: "LEFT JOIN account ON 1=1; DROP TABLE users; --",
                  },
               },
            },
         });
         expect(() => join.write(context)).toThrow("Invalid join type");
      });

      test("type with subquery injection throws", () => {
         const join = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
         const context = new SqlBuildContext({
            dialect: "sqlite",
            params: {
               joinBy: {
                  account: {
                     on: [["_.accountId", "=", "account.accountId"]],
                     type: "FULL OUTER) SELECT * FROM secrets; --",
                  },
               },
            },
         });
         expect(() => join.write(context)).toThrow("Invalid join type");
      });
   });
});
