import { describe, test } from "vitest";
import { param, row, SqlCharm, SqlParam, SqlQuery } from "../query/index.js";
import { Account } from "./models/valnor_test.account-table.js";
import {
   InferParamsFromQuery,
   InferParamsFromQueryTokens,
   InferRowFromQuery,
   InferRowFromQueryTokens,
   sql,
} from "../sql.js";
import { SqlInputArgs } from "../sql-types.js";
import { AccountStatusUdt } from "./models/valnor_test-enums.js";

describe("sql query type tests", () => {
   test("Infer row result type from sql-row", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const x = row(Account.firstName, Account.lastName, Account.createdAt);
      type Row = InferRowFromQueryTokens<[typeof x]>;
      // eslint-disable-next-line prefer-const
      let actual: Row = {
         firstName: "a",
         lastName: "b",
         createdAt: new Date(),
      };
      console.log(actual.firstName);
   });

   test("Infer params from sql-query", () => {
      type FullParams = InferParamsFromQueryTokens<
         [
            typeof Account,
            typeof Account.$all,
            SqlParam<{ Name: "accountId"; Type: string }>,
            SqlParam<{ Name: "modifiedAt"; Type: Date }>,
            SqlQuery<{ Params: { limit: 5 } }>,
            SqlCharm<{ Params: { createdAt: Date } }>,
         ]
      >;
      // eslint-disable-next-line unused-imports/no-unused-vars
      const fullParams: FullParams = {
         accountId: "",
         modifiedAt: new Date(),
         limit: 5,
         createdAt: new Date(),
      };
      type FullInputArgs = SqlInputArgs<FullParams>;
      // eslint-disable-next-line unused-imports/no-unused-vars
      const fullInputArgs: FullInputArgs = {
         params: {
            accountId: "",
            modifiedAt: new Date(),
            limit: 5,
            createdAt: new Date(),
         },
      };

      type EmptyParams = InferParamsFromQueryTokens<[typeof Account, typeof Account.$all, typeof Account.accountId]>;
      // eslint-disable-next-line unused-imports/no-unused-vars
      const emptyParams: EmptyParams = {};
      type EmptyInputArgs = SqlInputArgs<EmptyParams>;
      // eslint-disable-next-line unused-imports/no-unused-vars
      const emptyInputArgs: EmptyInputArgs = {};
   });

   test("infer row result type from sql-query", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sql`
         select ${row(Account.firstName, Account.lastName("name"), Account.createdAt)}
         from ${Account}
         where ${Account.accountId} = ${param("accountId").is<string>()}
      `;

      // eslint-disable-next-line unused-imports/no-unused-vars
      const r: InferRowFromQuery<typeof query> = {
         firstName: "a",
         name: "b",
         createdAt: new Date(),
      };

      // eslint-disable-next-line unused-imports/no-unused-vars
      const p: InferParamsFromQuery<typeof query> = {
         accountId: "123",
      };
   });

   test("query without row type", () => {
      const query = sql`
         update ${Account}
         set ${Account.$set({ status: AccountStatusUdt.CONFIRMED })} 
         where ${Account.accountId} = ${param("accountId").is<string>()}`;

      type Row = InferRowFromQuery<typeof query>;
      const row: Row = void 0;
   });
});
