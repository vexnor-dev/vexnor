import { describe, expect, test } from "vitest";
import { SqlTable, SqlTableColumn } from "../../schema/index.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { Sql } from "../../sql-base.js";

describe("SqlTable tests", () => {
   test("SqlTable inherits SqlBase", () => {
      expect(Account).instanceof(SqlTable);
      expect(Account).instanceof(Sql);
   });

   test("SqlTable should include expected columns", () => {
      expect(Account.$accountId).toBeDefined();
      expect(Account.$status).toBeDefined();
      expect(Account.$email).toBeDefined();

      expect(typeof Account.$accountId).toEqual("function");
      expect(typeof Account.$status).toEqual("function");
      expect(typeof Account.$email).toEqual("function");
   });

   test("SqlTable alias should return new SqlTable instance", () => {
      const actual = Account`parent`;
      console.log(actual);
      expect(actual).toBeDefined();
      expect(actual.tableInfo).toEqual(
         expect.objectContaining({
            schema: "valnor_test",
            name: "account",
            alias: "parent",
         }),
      );
   });

   test("SqlTable alias should return new SqlColumn instance", () => {
      const actual = Account`parent`.$accountId;
      console.log(actual);
      expect(actual).toBeDefined();
      expect(actual.tableInfo).toEqual<typeof actual.tableInfo>({
         schema: "valnor_test",
         name: "account",
         alias: "parent",
      });
      expect(actual.columnName).toEqual("account_id");
      expect(actual.key).toEqual("accountId");
   });

   test("SqlTable alias should return new SqlTable instance with respective $$all columns", () => {
      const actual = Account`inserted`.$$all;
      for (const col of Object.values(actual.row)) {
         expect(col).toBeDefined();
         expect(col).toBeInstanceOf(Sql);
         expect(col).toBeInstanceOf(SqlTableColumn);
         expect(col.tableInfo).toEqual<typeof col.tableInfo>({
            schema: "valnor_test",
            name: "account",
            alias: "inserted",
         });
         const original = Account.column(col.key);
         expect(col.key).toBe(original.key);
         expect(col.columnName).toBe(original.columnName);
      }
   });
});
