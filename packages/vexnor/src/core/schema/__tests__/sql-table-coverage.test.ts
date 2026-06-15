import { describe, expect, test } from "vitest";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { AccountStatusUdt } from "@test-models/vexnor_dev-enums.js";

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
      const col = Account.column("$accountId");
      expect(col.key).toBe("accountId");
   });

   test("column() throws for unknown column", () => {
      expect(() => Account.column("$nonExistent")).toThrow("Column not found");
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

   test("updateSet() creates SQL for update", () => {
      const update = Account.updateSet({ email: "test@test.com" });
      expect(update).toBeDefined();
   });

   test("updateSet() throws when update is null", () => {
      expect(() => Account.updateSet(null as never)).toThrow();
   });

   test("insertColsVals() creates insert SQL", () => {
      const insert = Account.insertColsVals({ accountId: "1", email: "a@b.com", firstName: "A", lastName: "B", status: AccountStatusUdt.CREATED });
      expect(insert).toBeDefined();
   });

   test("insertCols() creates column list only", () => {
      const cols = Account.insertCols({ accountId: "1", email: "a@b.com", firstName: "A", lastName: "B", status: AccountStatusUdt.CREATED });
      expect(cols).toBeDefined();
   });

   test("insertVals() creates values clause only", () => {
      const vals = Account.insertVals({ accountId: "1", email: "a@b.com", firstName: "A", lastName: "B", status: AccountStatusUdt.CREATED });
      expect(vals).toBeDefined();
   });

   test("insertColsVals() throws with empty array", () => {
      expect(() => (Account as unknown as { insertColsVals: () => void }).insertColsVals()).toThrow();
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
