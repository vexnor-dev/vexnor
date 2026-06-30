import { describe, expect, test, beforeEach } from "vitest";
import { SqlFilterBy } from "#src/core/operators/sql-filter-by.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { Account, Order } from "@test-models/vexnor_dev.schema.js";
import { SqlTable } from "#src/core/schema/sql-table.js";

describe("SqlFilterBy — writeEntry with columnMap (context.columnCount > 0)", () => {
   beforeEach(() => {
      SqlTable.register(Account);
      SqlTable.register(Order);
   });

   test("resolves column from context columnMap and emits col = value", () => {
      const filter = new SqlFilterBy(Account, { paramName: "filterBy", prefix: "where " });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: { filterBy: { email: "test@test.com" } },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      // Populate columnMap so context.columnCount > 0
      context.addColumns({ email: Account.$email, status: Account.$status });
      filter.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "WHERE
          "a_1"."email" = ?"
      `);
      expect(context.values).toMatchInlineSnapshot(`
        [
          "test@test.com",
        ]
      `);
   });

   test("resolves column and handles array operator from columnMap", () => {
      const filter = new SqlFilterBy(Account, { paramName: "filterBy", prefix: "where " });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: { filterBy: { email: ["like", "%@example.com"] } },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      context.addColumns({ email: Account.$email });
      filter.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "WHERE
          "a_1"."email" like ?"
      `);
      expect(context.values).toMatchInlineSnapshot(`
        [
          "%@example.com",
        ]
      `);
   });

   test("throws when column not found in columnMap", () => {
      const filter = new SqlFilterBy(Account, { paramName: "filterBy", prefix: "where " });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: { filterBy: { nonExistent: "value" } },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      context.addColumns({ email: Account.$email });
      expect(() => filter.write(context)).toThrow("Column not found: nonExistent");
   });

   test("throws for invalid filter operator in columnMap path", () => {
      const filter = new SqlFilterBy(Account, { paramName: "filterBy", prefix: "where " });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: { filterBy: { email: ["invalidOp", "val"] } },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      context.addColumns({ email: Account.$email });
      expect(() => filter.write(context)).toThrow("Invalid filter operator: invalidOp");
   });

   test("throws for non-primitive value in columnMap path", () => {
      const filter = new SqlFilterBy(Account, { paramName: "filterBy", prefix: "where " });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: { filterBy: { email: { nested: "object" } } },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      context.addColumns({ email: Account.$email });
      expect(() => filter.write(context)).toThrow("Filter value is not a primitive");
   });

   test("skips undefined values in conditions", () => {
      const filter = new SqlFilterBy(Account, { paramName: "filterBy", prefix: "where " });
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: { filterBy: { email: undefined, status: "active" } },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      context.addColumns({ email: Account.$email, status: Account.$status });
      filter.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "WHERE
          "a_1"."status" = ?"
      `);
      expect(context.values).toMatchInlineSnapshot(`
        [
          "active",
        ]
      `);
   });
});
