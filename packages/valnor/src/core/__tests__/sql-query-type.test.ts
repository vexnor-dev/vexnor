import { describe, expect, test } from "vitest";
import { param, row, SqlCharm, SqlInputArgs, SqlParam, SqlQuery, SqlQueryExtended } from "../query/index.js";
import { Account } from "./models/valnor_test.account-table.js";
import {
   ExtractParamsFromQuery,
   InferParamsFromQueryTokens,
   ExtractResultRowFromQuery,
   InferResultRowFromQueryTokens,
   QueryParams,
   sql,
} from "../sql.js";
import { AccountStatusUdt } from "./models/valnor_test-enums.js";

describe("sql query type tests", () => {
   test("Infer row result type from sql-row", () => {
      const result = row(Account.$firstName, Account.$lastName, Account.$createdAt);
      expect(result).toBeDefined();

      type Row = InferResultRowFromQueryTokens<[typeof result]>;
      const actual: Row = {
         firstName: "a",
         lastName: "b",
         createdAt: new Date(),
      };
      expect(actual).toBeDefined();
      console.log(actual.$firstName);
   });

   test("Infer params from sql-query", () => {
      type FullParams = InferParamsFromQueryTokens<
         [
            typeof Account,
            typeof Account.$$,
            SqlParam<{ Name: "accountId"; Type: string }>,
            SqlParam<{ Name: "modifiedAt"; Type: Date }>,
            SqlQueryExtended<{ Params: { limit: 5 } }>,
            SqlCharm<{ Params: { createdAt: Date } }>,
         ]
      >;

      const fullParams: FullParams = {
         accountId: "",
         modifiedAt: new Date(),
         limit: 5,
         createdAt: new Date(),
      };
      expect(fullParams).toBeDefined();

      type FullInputArgs = SqlInputArgs<FullParams>;

      const fullInputArgs: FullInputArgs = {
         params: {
            accountId: "",
            modifiedAt: new Date(),
            limit: 5,
            createdAt: new Date(),
         },
      };
      expect(fullInputArgs).toBeDefined();

      type EmptyParams = QueryParams<[typeof Account, typeof Account.$$, typeof Account.$accountId]>;
      const emptyParams: EmptyParams = void 0;
      expect(emptyParams).toBeUndefined();
      type EmptyInputArgs = SqlInputArgs<EmptyParams>;
      const emptyInputArgs: EmptyInputArgs = {};
      expect(emptyInputArgs).toBeDefined();
   });

   test("infer row result type from sql-query", () => {
      const query = sql`
         select ${row(Account.$firstName, Account.$lastName.as("name"), Account.$createdAt)}
         from ${Account}
         where ${Account.$accountId} = ${param("accountId").is<string>()}
      `;

      expect(query).toBeInstanceOf(SqlQuery);

      const result: ExtractResultRowFromQuery<typeof query> = {
         firstName: "a",
         name: "b",
         createdAt: new Date(),
      };
      expect(result).toBeDefined();

      const params: ExtractParamsFromQuery<typeof query> = {
         accountId: "123",
      };
      expect(params).toBeDefined();
   });

   test("query without row type", () => {
      const query = sql`
         update ${Account}
         set ${Account.updateSet({ status: AccountStatusUdt.CONFIRMED })} 
         where ${Account.$accountId} = ${param("accountId").is<string>()}`;

      expect(query).toBeInstanceOf(SqlQuery);
      expect(query.ID).toBeDefined();

      type Result = ExtractResultRowFromQuery<typeof query>;
      const result: Result = undefined;
      expect(result).toBeUndefined();
   });

   test("query without params", () => {
      const query = sql`
         update ${Account}
         set ${Account.updateSet({ status: AccountStatusUdt.CONFIRMED })} 
         where ${Account.$accountId} = ${1}
         returning ${row(Account.$$)}`;

      expect(query).toBeInstanceOf(SqlQuery);
      expect(query.ID).toBeDefined();

      type Result = ExtractResultRowFromQuery<typeof query>;
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
