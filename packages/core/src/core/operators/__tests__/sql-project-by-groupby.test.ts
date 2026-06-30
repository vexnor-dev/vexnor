import { describe, expect, test, beforeEach } from "vitest";
import { SqlProjectionGroupBy, SqlProjectBy } from "#src/core/operators/sql-project-by.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { Account, Order } from "@test-models/vexnor_dev.schema.js";
import { SqlTable } from "#src/core/schema/sql-table.js";

describe("SqlProjectionGroupBy — coverage", () => {
   beforeEach(() => {
      SqlTable.register(Account);
      SqlTable.register(Order);
   });

   test("write() emits nothing when params is undefined", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({ dialect: "postgresql" });
      // No params set
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`""`);
   });

   test("write() emits nothing when selectObj is null", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({ dialect: "postgresql", params: { select: null } });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`""`);
   });

   test("write() emits nothing when selectObj is empty object", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({ dialect: "postgresql", params: { select: {} } });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`""`);
   });

   test("write() emits GROUP BY for aggregate + plain column", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({ dialect: "postgresql", params: { select: { status: true, total: { fn: "count", col: "*" } } } });
      // Need an alias for the table
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "GROUP BY
          "a_1"."status""
      `);
   });

   test("write() emits nothing when no aggregate present (all plain columns)", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({ dialect: "postgresql", params: { select: { status: true, email: true } } });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`""`);
   });

   test("write() with dateTrunc transform generates GROUP BY with date_trunc (postgresql)", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               month: { fn: "dateTrunc", col: "createdAt", args: "month" },
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "GROUP BY
          date_trunc('month', "a_1"."created_at")"
      `);
   });

   test("write() with dateTrunc transform for sqlite dialect", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "sqlite",
         params: {
            select: {
               month: { fn: "dateTrunc", col: "createdAt", args: "month" },
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "GROUP BY
          strftime('%Y-%m-01', "a_1"."created_at")"
      `);
   });

   test("write() with dateTrunc transform for transactsql dialect", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "transactsql",
         params: {
            select: {
               month: { fn: "dateTrunc", col: "createdAt", args: "month" },
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "GROUP BY
          DATETRUNC (month, "a_1"."created_at")"
      `);
   });

   test("write() with coalesce transform in GROUP BY", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               notes: { fn: "coalesce", col: "notes", args: "N/A" },
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "GROUP BY
          coalesce("a_1"."notes", 'N/A')"
      `);
   });

   test("write() with round transform (with precision) in GROUP BY", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               rounded: { fn: "round", col: "notes", args: [2] },
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "GROUP BY
          round("a_1"."notes", 2)"
      `);
   });

   test("write() with round transform (no precision) in GROUP BY", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               rounded: { fn: "round", col: "notes", args: null },
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "GROUP BY
          round("a_1"."notes")"
      `);
   });

   test("write() with round transform (invalid precision) returns null — no group by emitted for that entry", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               rounded: { fn: "round", col: "notes", args: "notANumber" },
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      // Invalid precision returns null so no group by expression for that entry
      expect(context.text).toMatchInlineSnapshot(`""`);
   });

   test("write() with invalid dateTrunc granularity returns null — no group by for that entry", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               month: { fn: "dateTrunc", col: "createdAt", args: "century" },
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`""`);
   });

   test("write() with column rename (string value) in GROUP BY", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               st: "status",
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "GROUP BY
          "a_1"."status""
      `);
   });

   test("resolveColumn with dot-notation resolves table.column", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               st: "account.status",
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "GROUP BY
          "a_1"."status""
      `);
   });

   test("resolveColumn throws for unknown column", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               bad: "nonExistentColumn",
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      expect(() => groupBy.write(context)).toThrow("Column not found: nonExistentColumn");
   });
});

describe("SqlProjectBy.renderDateTrunc — error branch", () => {
   test("throws on invalid granularity", () => {
      const proj = new SqlProjectBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               period: { fn: "dateTrunc", col: "createdAt", args: "invalid" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      expect(() => proj.write(context)).toThrow("Invalid dateTrunc granularity");
   });
});

describe("SqlProjectBy.renderColRef — with context columns", () => {
   test("renderColRef resolves from context columns when available", () => {
      const proj = new SqlProjectBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               total: { fn: "count", col: "email" },
            },
         },
      });
      // Add columns to context so columnCount > 0
      context.addColumns({ email: Account.$email });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      proj.write(context);
      expect(context.text).toMatchInlineSnapshot(`"count("a_1"."email") AS "total""`);
   });
});

describe("SqlProjectionGroupBy — concat transform parameterization", () => {
   test("concat in GROUP BY uses positional params instead of raw ?", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               fullName: { fn: "concat", col: "firstName", args: [" ", "lastName"] },
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      // Should produce parameterized GROUP BY — no raw ? characters
      expect(context.text).not.toContain("?");
      expect(context.text).toMatchInlineSnapshot(`
        "GROUP BY
          "a_1"."first_name" || ' ' || 'lastName'"
      `);
      expect(context.values).toMatchInlineSnapshot(`[]`);
   });

   test("coalesce in GROUP BY uses positional params", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               safeName: { fn: "coalesce", col: "firstName", args: ["unknown"] },
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).not.toContain("?");
      expect(context.text).toMatchInlineSnapshot(`
        "GROUP BY
          coalesce("a_1"."first_name", 'unknown')"
      `);
      expect(context.values).toMatchInlineSnapshot(`[]`);
   });

   test("dateTrunc in GROUP BY has no params (literal granularity)", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               period: { fn: "dateTrunc", col: "createdAt", args: "month" },
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).not.toContain("?");
      expect(context.text).toMatchInlineSnapshot(`
        "GROUP BY
          date_trunc('month', "a_1"."created_at")"
      `);
      expect(context.values).toMatchInlineSnapshot(`[]`);
   });

   test("coalesce with null arg emits NULL literal", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               safeName: { fn: "coalesce", col: "notes", args: [null] },
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "GROUP BY
          coalesce("a_1"."notes", NULL)"
      `);
      expect(context.values).toMatchInlineSnapshot(`[]`);
   });

   test("coalesce with boolean arg emits stringified value", () => {
      const groupBy = new SqlProjectionGroupBy(Account, "select");
      const context = new SqlBuildContext({
         dialect: "postgresql",
         params: {
            select: {
               safeName: { fn: "coalesce", col: "notes", args: [true] },
               total: { fn: "count", col: "*" },
            },
         },
      });
      context.setAlias(Account.tableInfo, { alias: "a_1" });
      groupBy.write(context);
      expect(context.text).toMatchInlineSnapshot(`
        "GROUP BY
          coalesce("a_1"."notes", 'true')"
      `);
      expect(context.values).toMatchInlineSnapshot(`[]`);
   });
});
