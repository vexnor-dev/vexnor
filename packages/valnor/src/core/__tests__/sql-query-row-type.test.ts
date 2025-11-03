import { describe, test } from "vitest";
import { param, row } from "../query/index.js";
import { Account } from "./models/one_sql.account-table.js";
import { InferParamsFromQuery, InferRowFromQuery, InferRowFromQueryTokens, sql } from "../sql.js";

describe("sql query row type tests", () => {
   test("Infer row result type from sql-row", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const x = row(Account.firstName, Account.lastName, Account.createdAt);
      type Type = InferRowFromQueryTokens<[typeof x, typeof Account.modifiedAt, typeof Account]>;
      // eslint-disable-next-line prefer-const
      let actual: Type = {
         firstName: "a",
         lastName: "b",
         createdAt: new Date(),
      };
      console.log(actual.firstName);
   });

   test("infer row result type from sql-query", () => {
      const col = Account.createdAt("startedAt");
      const query = sql`
         select ${row(Account.firstName, Account.lastName("name"), Account.createdAt)}
         from ${Account}
         where ${Account.accountId} = ${param.string("accountId")}
      `;

      const r: InferRowFromQuery<typeof query> = {
         firstName: "a",
         name: "b",
         createdAt: new Date(),
      };

      const p: InferParamsFromQuery<typeof query> = {
         accountId: "123",
      };
   });
});
