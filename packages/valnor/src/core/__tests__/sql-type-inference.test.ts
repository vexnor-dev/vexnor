import { describe, expect, test } from "vitest";
import { InferParamsFromQueryTokens, QueryParams } from "../sql.js";
import { SqlParam } from "../query/index.js";
import { Account } from "@test-models/valnor_test.account-table.js";

describe("sql() type inference", () => {
   test("InferParamsFromQueryTokens from sql-query with tokens and params", () => {
      type Params = InferParamsFromQueryTokens<
         [typeof Account, typeof Account.$$, typeof Account.$accountId, SqlParam<{ Name: "accountId"; Type: string }>]
      >;
      const params: Params = {
         accountId: "",
      };
      expect(params).toBeDefined();
      expect(params.accountId).toBeDefined();
   });

   test("InferParamsFromQueryTokens from sql-query with params", () => {
      type Params = InferParamsFromQueryTokens<[SqlParam<{ Name: "accountId"; Type: string }>]>;
      const params: Params = {
         accountId: "",
      };
      expect(params).toBeDefined();
      expect(params.accountId).toBeDefined();
   });

   test("InferParamsFromQueryTokens from sql-query without any params", () => {
      type Params = InferParamsFromQueryTokens<[typeof Account, typeof Account.$$, typeof Account.$accountId]>;
      const params: Params = undefined; /* unknown */
      expect(params).toBeUndefined();
   });

   test("QueryParams from sql-query without any params", () => {
      type Params = QueryParams<[typeof Account, typeof Account.$$, typeof Account.$accountId]>;
      const params: Params = void 0; /* unknown */
      expect(params).toBeUndefined();
   });
});
