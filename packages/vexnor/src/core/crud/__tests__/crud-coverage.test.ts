import { describe, expect, test } from "vitest";
import { sqlSelect } from "#/core/crud/sql-select.js";
import { sqlUpdate } from "#/core/crud/sql-update.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { sql } from "#/core/sql.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { info } from "#/core/charms/sql-query-info.js";

describe("sqlSelect — uncovered paths", () => {
   test("sqlSelect with WHERE clause", () => {
      const result = sqlSelect(Account, { WHERE: sql`${Account.$status} = ${"active"}` });
      expect(result).toBeDefined();
      expect(result.row).toBeDefined();
   });

   test("sqlSelect with info", () => {
      const result = sqlSelect(Account, {}, info({ label: "test-select" }));
      expect(result).toBeDefined();
   });

   test("sqlSelect with GROUP_BY", () => {
      const result = sqlSelect(Account, { GROUP_BY: sql`${Account.$status}` });
      expect(result).toBeDefined();
   });

   test("sqlSelect with HAVING", () => {
      const result = sqlSelect(Account, { GROUP_BY: sql`${Account.$status}`, HAVING: sql`count(*) > 1` });
      expect(result).toBeDefined();
   });

   test("sqlSelect with ORDER_BY", () => {
      const result = sqlSelect(Account, { ORDER_BY: sql`${Account.$email} ASC` });
      expect(result).toBeDefined();
   });

   test("sqlSelect with JOIN clause", () => {
      const result = sqlSelect(Account, {
         JOIN: sql`JOIN orders ON orders.account_id = accounts.account_id`,
      });
      expect(result).toBeDefined();
   });

   test("sqlSelect throws for includeMany", () => {
      expect(() =>
         sqlSelect(Account, { includeMany: { orders: sql`SELECT 1` } }),
      ).toThrow("includeMany");
   });

   test("sqlSelect throws for includeOne", () => {
      expect(() =>
         sqlSelect(Account, { includeOne: { account: sql`SELECT 1` } }),
      ).toThrow("includeOne");
   });
});

describe("sqlUpdate — uncovered paths", () => {
   test("sqlUpdate with WHERE clause produces query", () => {
      const result = sqlUpdate(Account, { WHERE: sql`${Account.$accountId} = ${"123"}` });
      expect(result).toBeDefined();
      const context = new SqlBuildContext({ dialect: "sql", params: { set: { email: "new@test.com" } } });
      result.build(context, null, { queryType: "main" });
      expect(context.tokens.length).toBeGreaterThan(0);
   });

   test("sqlUpdate without WHERE clause", () => {
      const result = sqlUpdate(Account, {});
      expect(result).toBeDefined();
   });

   test("sqlUpdate with info", () => {
      const result = sqlUpdate(Account, {}, info({ label: "update-account" }));
      expect(result).toBeDefined();
   });
});
