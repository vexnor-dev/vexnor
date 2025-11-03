import { describe, expect, test } from "vitest";
import { Account } from "./models/one_sql.account-table.js";

describe("SqlTable tests", () => {
   test("SqlColumn alias should return new SqlColumn instance", () => {
      const actual = Account.firstName`parentFirstName`;
      console.log(actual);
      expect(actual.name).toEqual("first_name");
      expect(actual.key).toEqual("parentFirstName");
      expect(actual.tableInfo).toEqual({
         schema: "valnor_test",
         name: "account",
      });
   });

   test("SqlColumn alias from SqlTable alias should return new SqlColumn instance", () => {
      const actual = Account`parent`.firstName`parentFirstName`;
      console.log(actual);
      expect(actual).toBeDefined();
      expect(actual.tableInfo).toEqual({
         schema: "valnor_test",
         name: "account",
         alias: "parent",
      });
      expect(actual.name).toEqual("first_name");
      expect(actual.key).toEqual("parentFirstName");
   });
});
