import { Account } from "@test-models/valnor_test.account-table.js";
import { describe, expect, test } from "vitest";
import { Sql } from "../../sql-base.js";
import { SqlTableColumn } from "../sql-table-column.js";

describe("SqlColumn tests", () => {
   test("SqlColumn should be defined", () => {
      expect(Account.accountId).toBeDefined();
   });

   test("SqlColumn inherits Sql", () => {
      expect(Account.accountId).instanceof(Sql);
      expect(Account.accountId instanceof Sql).toBe(true);
   });

   test("SqlColumn inherits SqlColumn", () => {
      expect(Account.accountId).instanceof(SqlTableColumn);
      expect(Account.accountId instanceof SqlTableColumn).toBe(true);
   });

   test("SqlColumn to be defined", () => {
      expect(Account.accountId).toBeDefined();
   });

   test("SqlColumn to match definition", () => {
      expect({ ...Account.accountId }).toMatchObject({
         columnName: "account_id",
         key: "accountId",
         tableInfo: {
            name: "account",
            schema: "valnor_test",
         },
      });
   });

   test("SqlColumn alias should return new SqlColumn instance", () => {
      expect(Account.firstName.key).toEqual("firstName");
      expect({ ...Account.firstName("parentFirstName") }).toMatchObject({
         columnName: "first_name",
         key: "parentFirstName",
         tableInfo: {
            schema: "valnor_test",
            name: "account",
         },
      });
   });

   test("SqlColumn alias from SqlTable alias should return new SqlColumn instance", () => {
      expect({ ...Account`parent`.firstName("parentFirstName") }).toMatchObject({
         columnName: "first_name",
         key: "parentFirstName",
         tableInfo: {
            schema: "valnor_test",
            name: "account",
            alias: "parent",
         },
      });
   });
});
