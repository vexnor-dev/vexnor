import { assertType, describe, expect, test } from "vitest";
import { param, row, SqlQuery } from "../query/index.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { ExtractParamsFromSqlQuery, sql, SqlRow } from "../sql.js";
import { AccountStatusUdt } from "@test-models/valnor_test-enums.js";
import { RowOf } from "../sql-base.js";

describe("sql query type tests", () => {
   test("Infer row result type from sql-row", () => {
      const result = row(Account.$firstName, Account.$lastName, Account.$createdAt);
      expect(result).toBeDefined();

      type Row = SqlRow<[typeof result]>;
      const actual: Row = {
         firstName: "a",
         lastName: "b",
         createdAt: new Date(),
      };
      expect(actual).toBeDefined();
      console.log(actual.firstName);
   });

   test("infer row result type from sql-query", () => {
      const query = sql`
         select ${row(Account.$firstName, Account.$lastName.as("name"), Account.$createdAt)}
         from ${Account}
         where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
      `;

      expect(query).toBeInstanceOf(SqlQuery);

      const result: RowOf<typeof query> = {
         firstName: "a",
         name: "b",
         createdAt: new Date(),
      };
      expect(result).toBeDefined();

      const params: ExtractParamsFromSqlQuery<typeof query> = {
         accountId: "123",
      };
      expect(params).toBeDefined();
   });

   test("query without row type", () => {
      const query = sql`
         update ${Account}
         set ${Account.updateSet({ status: AccountStatusUdt.CONFIRMED })} 
         where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`;

      expect(query).toBeInstanceOf(SqlQuery);
      expect(query.id).toBeDefined();

      type Result = RowOf<typeof query>;
      assertType<Result>(void 0);
   });

   test("query without params", () => {
      const query = sql`
         update ${Account}
         set ${Account.updateSet({ status: AccountStatusUdt.CONFIRMED })} 
         where ${Account.$accountId} = ${1}
         returning ${row(Account.$$)}`;

      expect(query).toBeInstanceOf(SqlQuery);
      expect(query.id).toBeDefined();

      type Result = RowOf<typeof query>;
      const result: Result = {
         accountId: "XXX",
         firstName: "a",
         lastName: "b",
         status: AccountStatusUdt.CONFIRMED,
         createdAt: new Date(),
         modifiedAt: new Date(),
         email: "c",
         notes: "d",
         parentId: "a",
      };
      expect(result).toBeDefined();
   });
});
