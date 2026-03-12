import { assertType, describe, expect, test } from "vitest";
import { SqlParams, sql } from "#/core/sql.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { SqlInputArgs } from "#/core/query/sql-query-types.js";
import { param, SqlParam } from "#/core/query/sql-param.js";
import { SqlQueryExtended } from "#/core/query/sql-query.js";
import { SqlCharm } from "#/core/query/sql-charm.js";
import { row } from "#/core/query/sql-select-row.js";
import { AccountStatusUdt } from "@test-models/valnor_test-enums.js";

describe("SqlQuery Type inference", () => {
   test("SqlInputArgs<> from Sql array including params", () => {
      type Params = SqlParams<
         [
            typeof Account,
            typeof Account.$$,
            SqlParam<{ Name: "accountId"; Type: string }>,
            SqlParam<{ Name: "modifiedAt"; Type: Date }>,
            SqlQueryExtended<{ Params: { limit: 5 } }>,
            SqlCharm<{ Params: { createdAt: Date } }>,
         ]
      >;

      type Input = SqlInputArgs<Params>;
      assertType<Input>({
         params: {
            accountId: "XXX",
            modifiedAt: new Date(),
            limit: 5,
            createdAt: new Date(),
            // @ts-expect-error - Testing runtime validation of missing property
            status: "unknown",
         },
      });
   });

   test("SqlInputArgs<> from Sql array without params", () => {
      type Params = SqlParams<[typeof Account, typeof Account.$$]>;

      type Input = SqlInputArgs<Params>;
      const input: Input = {};
      expect(input).toBeDefined();
   });

   test("SqlInputArgs<> from sql`...` call without Row, without Params", () => {
      const query = sql`SELECT ${Account.$$} FROM ${Account}`;
      const text = query.getSql({});
      expect(text).toBeDefined();
   });

   test("SqlInputArgs<> from sql`...` call without Row, without Params including inline value", () => {
      const query = sql`SELECT ${Account.$$} FROM ${Account} WHERE ${Account.$accountId} = ${""}`;
      const text = query.getSql({});
      expect(text).toBeDefined();
   });

   test("SqlInputArgs<> from sql`...` call with Row, without Params including inline value", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${""}`;
      const text = query.getSql({});
      expect(text).toBeDefined();
   });

   test("SqlInputArgs<> from sql`...` call with Row, with Params", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`;
      const text = query.getSql({
         params: {
            accountId: "",
         },
      });
      expect(text).toBeDefined();
   });

   test("SqlInputArgs<> from sql`` including subquery without Params", () => {
      const subquery = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$status} = ${AccountStatusUdt.CONFIRMED}`;
      const query = sql`SELECT ${row(Account.$$)} FROM ${subquery}`;
      const text = query.getSql({});
      expect(text).toBeDefined();
   });
});
