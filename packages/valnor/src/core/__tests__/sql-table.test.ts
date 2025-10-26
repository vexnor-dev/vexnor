import { describe, expect, test } from "vitest";
import { Account } from "./models/one_sql.account-table.js";

describe("SqlTable tests", () => {
   test("SqlTable alias should return new SqlTable instance", () => {
      const actual = Account`parent`;
      console.log(actual);
      expect(actual).toBeDefined();
      expect(actual.$$.schema).toBe("valnor_test");
      expect(actual.$$.name).toBe("account");
      expect(actual.$$.alias).toBe("parent");
   });

   test("SqlTable alias should return new SqlColumn instance", () => {
      const actual = Account`parent`.accountId;
      console.log(actual);
      expect(actual).toBeDefined();
      expect(actual.tableInfo).toEqual<typeof actual.tableInfo>({
         schema: "valnor_test",
         name: "account",
         alias: "parent",
      });
      expect(actual.name).toEqual("account_id");
      expect(actual.alias).toEqual("accountId");
   });

   test("SqlTable alias should return new SqlTable instance with respective $$all columns", () => {
      const actual = Account`inserted`.$$all;
      for (const col of actual) {
         expect(col.tableInfo).toEqual<typeof col.tableInfo>({
            schema: "valnor_test",
            name: "account",
            alias: "inserted",
         });
         const original = Account.$$column(col.alias ?? col.name);
         expect(col.alias).toBe(original.alias);
         expect(col.name).toBe(original.name);
      }
   });
});
