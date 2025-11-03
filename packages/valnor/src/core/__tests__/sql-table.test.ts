import { describe, expect, test } from "vitest";
import { Account, IAccountSelect } from "./models/one_sql.account-table.js";
import { InferSqlAllFromSelect } from "../schema/index.js";

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
      expect(actual.key).toEqual("accountId");
   });

   test("SqlTable alias should return new SqlTable instance with respective $$all columns", () => {
      const actual = Account`inserted`.$$all;
      for (const col of actual.columns) {
         expect(col.tableInfo).toEqual<typeof col.tableInfo>({
            schema: "valnor_test",
            name: "account",
            alias: "inserted",
         });
         const original = Account.$$column(col.key);
         expect(col.key).toBe(original.key);
         expect(col.name).toBe(original.name);
      }
   });

   test("Infer $$all(*) from SqlTable", () => {
      type X = InferSqlAllFromSelect<IAccountSelect>;
      const x: X = [Account.accountId, Account.status, Account.email, Account.firstName, Account.lastName];
   });
});
