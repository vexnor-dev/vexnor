import { describe, expect, test, beforeEach } from "vitest";
import { Account, Order } from "@test-models/vexnor_dev.schema.js";
import { SqlTable } from "#src/core/schema/sql-table.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";

describe("SqlTableColumn.raw — coverage", () => {
   beforeEach(() => {
      SqlTable.register(Account);
   });

   test("raw getter returns column rendered as tableAlias.columnName", () => {
      const rawCol = Account.$accountId.raw;
      const context = new SqlBuildContext({ dialect: "sqlite" });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      rawCol.build(context);
      expect(context.text).toMatchInlineSnapshot(`""a_1"."account_id""`);
   });

   test("raw is equivalent to render(tableAlias.columnName)", () => {
      const rawCol = Account.$email.raw;
      const rendered = Account.$email.render("tableAlias.columnName");
      const ctx1 = new SqlBuildContext({ dialect: "sqlite" });
      const ctx2 = new SqlBuildContext({ dialect: "sqlite" });
      ctx1.setAlias(Account.tableInfo, { alias: "a_1" });
      ctx2.setAlias(Account.tableInfo, { alias: "a_1" });
      rawCol.build(ctx1);
      rendered.build(ctx2);
      expect(ctx1.text).toBe(ctx2.text);
   });
});

describe("SqlTable.resolve — coverage", () => {
   beforeEach(() => {
      SqlTable.clearRegistry();
      SqlTable.register(Account);
      SqlTable.register(Order);
   });

   test("resolves a registered table by source, schema, and name", () => {
      const resolved = SqlTable.resolve({ source: "@vexnor/test:models", schema: "main", table: "account" });
      expect(resolved).toBe(Account);
   });

   test("returns undefined for unregistered table", () => {
      const resolved = SqlTable.resolve({ source: "@vexnor/test:models", schema: "main", table: "nonexistent" });
      expect(resolved).toBeUndefined();
   });
});

describe("SqlTable.render — format error branch", () => {
   test("unknown format throws during write()", () => {
      const rendered = (Account as unknown as { render(f: string): typeof Account }).render("invalidFormat" as never);
      const context = new SqlBuildContext({ dialect: "sqlite" });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      expect(() => rendered.build(context)).toThrow("Unknown table format");
   });
});

describe("SqlTable.write — tableAlias format", () => {
   beforeEach(() => {
      SqlTable.register(Account);
   });

   test("renders as quoted alias in tableAlias format", () => {
      const aliased = Account.render("tableAlias");
      const context = new SqlBuildContext({ dialect: "sqlite" });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      aliased.build(context);
      expect(context.text).toMatchInlineSnapshot(`""a_1""`);
   });
});
