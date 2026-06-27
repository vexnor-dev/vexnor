import { describe, expect, test } from "vitest";
import { Account } from "@test-models/vexnor_dev.account-table.js";

describe("SqlTable — uncovered function paths", () => {
   test("as() with string creates alias", () => {
      const aliased = Account.as("acct");
      expect(aliased.tableInfo.alias).toBe("acct");
   });

   test("as() with template strings array", () => {
      const aliased = Account.as`myAlias`;
      expect(aliased.tableInfo.alias).toBe("myAlias");
   });

   test("column() returns column by key", () => {
      // @ts-expect-error column() type expects keyof Select but runtime uses $ prefix
      const col = Account.column("$accountId");
      expect(col.key).toBe("accountId");
   });

   test("column() throws for unknown column", () => {
      // @ts-expect-error non-existing column
      expect(() => Account.column("nonExistent")).toThrow("Column not found");
   });

   test("render() returns table with specified format", () => {
      const rendered = Account.render("tableName");
      expect(rendered.format).toBe("tableName");
      expect(rendered.tableInfo.name).toBe(Account.tableInfo.name);
   });

   test("render() with schema.tableName format", () => {
      const rendered = Account.render("schema.tableName");
      expect(rendered.format).toBe("schema.tableName");
   });

   test("$$ returns SqlTableAll", () => {
      expect(Account.$$).toBeDefined();
      expect(Account.$$.row).toBeDefined();
   });

   test("out provides output column references", () => {
      expect(Account.out).toBeDefined();
      expect(Account.out.$accountId).toBeDefined();
   });

   test("cols property available", () => {
      expect(Account.cols).toBeDefined();
      expect(Account.cols.$accountId).toBeDefined();
   });
});

describe("SqlTableColumn — uncovered paths", () => {
   test("as() creates column with new key", () => {
      const col = Account.$accountId;
      const aliased = col.as("myId");
      expect(aliased.key).toBe("myId");
   });

   test("jsonSchema from column with type", () => {
      const col = Account.$accountId;
      expect(col.jsonSchema).toBeDefined();
   });
});
