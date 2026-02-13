import { assertType, describe, expect, test } from "vitest";
import { ExtractParamsFromQuery, InferParamsFromSqlTokens, QueryParams, sql } from "../sql.js";
import { param, row, SqlInputArgs, SqlParam, SqlQueryExtended } from "../query/index.js";
import { Account, AccountStatusUdt } from "./models/valnor_test.schema.js";
import { info } from "../charms/index.js";
import { ParamsOf } from "../sql-base.js";

describe("SqlQuery.params", () => {
   test("InferParamFromSql<SqlParam>", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const id1 = param<{ id1: string }>("id1");
      type Params = ParamsOf<typeof id1>;
      assertType<Params>({
         id1: "",
         // @ts-expect-error - Testing runtime validation of extra property
         test: "a",
      });
   });

   test("InferParamFromSql<SqlQuery>", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const id1 = sql`${param<{ id1: string }>("id1")}`;
      type Params = ParamsOf<typeof id1>;
      assertType<Params>({
         id1: "",
         // @ts-expect-error - Testing runtime validation of extra property
         test: "a",
      });
   });

   test("Infer params from sql-query", () => {
      type FullParams = InferParamsFromSqlTokens<
         [
            typeof Account,
            typeof Account.$$,
            SqlParam<{ Name: "accountId"; Type: string }>,
            SqlParam<{ Name: "modifiedAt"; Type: Date }>,
            [
               SqlParam<{ Name: "id1"; Type: number }>,
               SqlParam<{ Name: "id2"; Type: number }>,
               SqlParam<{ Name: "id3"; Type: number }>,
            ],
            SqlQueryExtended<{ Params: { limit: 5 } }>,
         ]
      >;

      assertType<FullParams>({
         accountId: "",
         modifiedAt: new Date(),
         limit: 5,
         id1: 1,
         id2: 2,
         id3: 3,
         // @ts-expect-error - Testing runtime validation of extra property
         id4: 4,
      });

      type FullInputArgs = SqlInputArgs<FullParams>;
      assertType<FullInputArgs>({
         params: {
            accountId: "",
            modifiedAt: new Date(),
            limit: 5,
            id1: 1,
            id2: 2,
            id3: 3,
            // @ts-expect-error - Testing runtime validation of extra property
            id4: 4,
         },
      });

      type EmptyParams = QueryParams<[typeof Account, typeof Account.$$, typeof Account.$accountId]>;
      assertType<EmptyParams>(void 0);
      type EmptyInputArgs = SqlInputArgs<EmptyParams>;
      assertType<EmptyInputArgs>({});
   });

   test("InferParamsFromQueryTokens from sql-query with tokens and params", () => {
      type Params = InferParamsFromSqlTokens<
         [
            typeof Account,
            typeof Account.$$,
            typeof Account.$accountId,
            SqlParam<{ Name: "accountId"; Type: string }>,
            SqlParam<{ Name: "createdAt"; Type: Date }>,
         ]
      >;
      assertType<Params>({
         accountId: "",
         createdAt: new Date(),
         // @ts-expect-error - Testing runtime validation of extra property
         test: 4,
      });
   });

   test("InferParamsFromQueryTokens from sql-query with tokens and params incl. array", () => {
      type Params = InferParamsFromSqlTokens<
         [
            typeof Account,
            typeof Account.$$,
            typeof Account.$accountId,
            SqlParam<{ Name: "accountId"; Type: string }>,
            [SqlParam<{ Name: "createdAt"; Type: Date }>, SqlParam<{ Name: "modifiedAt"; Type: Date }>],
         ]
      >;
      assertType<Params>({
         accountId: "",
         createdAt: new Date(),
         modifiedAt: new Date(),
         // @ts-expect-error - Testing runtime validation of missing property
         status: "",
      });
   });

   test("InferParamsFromQueryTokens from sql-query without any params", () => {
      type Params = InferParamsFromSqlTokens<[typeof Account, typeof Account.$$, typeof Account.$accountId]>;
      // Params should be unknown when there are no params
      type ExpectedType = unknown;
      assertType<Params extends ExpectedType ? true : false>(true);
   });

   test("extracts params from query", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$email} = ${param<{ email: string }>("email")}
           and ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
      `;

      expect(query.params).toMatchObject({
         email: { name: "email" },
         accountId: { name: "accountId" },
      });
      expect(Object.keys(query.params)).toHaveLength(2);
      assertType<ExtractParamsFromQuery<typeof query>>({
         email: "",
         accountId: "",
         // @ts-expect-error - Testing runtime validation of missing property
         test: "",
      });
   });

   test("returns empty object when no params", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
      `;

      assertType<ExtractParamsFromQuery<typeof query>>(void 0);
      expect(query.params).toBeNull();
      // @ts-expect-error - Testing runtime validation of missing property
      expect(query.params?.accountId).toBeUndefined();
   });

   test("handles duplicate params", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$email} = ${param<{ email: string }>("email")}
            or ${Account.$email} = ${param<{ email: string }>("email")}
      `;

      assertType<ExtractParamsFromQuery<typeof query>>({
         email: "",
         // @ts-expect-error - Testing runtime validation of missing property
         test: "",
      });
      expect(query.params).toMatchObject({
         email: { name: "email" },
      });
      expect(Object.keys(query.params)).toHaveLength(1);
      expect(query.params.email).toMatchObject({ name: "email" });
      // @ts-expect-error - Testing runtime validation of missing property
      expect(query.params.status).toBeUndefined();
   });

   test("extracts params from subqueries", () => {
      const subquery = sql`
         ${info({ label: "Subquery" })}
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$email} = ${param<{ email: string }>("email")}
      `;

      const query = sql`
         select ${row(subquery.$$)}
         from ${subquery}
         where ${subquery.$accountId} = ${param<{ accountId: string }>("accountId")}
      `;

      assertType<ExtractParamsFromQuery<typeof query>>({
         email: "",
         accountId: "",
         // @ts-expect-error - Testing runtime validation of missing property
         test: "",
      });

      expect(query.params).toMatchObject({
         email: { name: "email" },
         accountId: { name: "accountId" },
      });
      expect(subquery.params).toMatchObject({
         email: { name: "email" },
      });
      expect(query.params.email).toMatchObject({ name: "email" });
      expect(query.params.accountId).toMatchObject({ name: "accountId" });
      expect(subquery.params.email).toMatchObject({ name: "email" });
      // @ts-expect-error - Testing runtime validation of missing property
      expect(query.params.status).toBeUndefined();
   });

   test("handles params in arrays", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} in
               (
                ${param<{ id1: string }>("id1")},
                ${param<{ id2: string }>("id2")},
                ${param<{ id3: string }>("id3")}
                  )
           and ${Account.$status} = ${param<{ status: AccountStatusUdt }>("status")}
      `;

      expect(query.params).toMatchObject({
         id1: { name: "id1" },
         id2: { name: "id2" },
         id3: { name: "id3" },
         status: { name: "status" },
      });
      expect(Object.keys(query.params)).toHaveLength(4);
      expect(query.params.id1).toMatchObject({
         name: "id1",
      });
      expect(query.params.id2).toMatchObject({
         name: "id2",
      });
      expect(query.params.id3).toMatchObject({
         name: "id3",
      });
      expect(query.params.status).toMatchObject({
         name: "status",
      });
   });

   test("includes params from subqueries with arrays", () => {
      const subquery = sql`
         ${info({ label: "Subquery" })}
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} in (${param<{ id1: string }>("id1")}, ${param<{ id2: string }>("id2")})
         and ${Account.$status} = ${AccountStatusUdt.CONFIRMED}
      `;

      const query = sql`
         select ${row(subquery.$$)}
         from ${subquery}
         where ${subquery.$email} = ${param<{ email: string }>("email")}
      `;

      expect(query.params).toMatchObject({
         id1: { name: "id1" },
         id2: { name: "id2" },
         email: { name: "email" },
      });
      expect(Object.keys(query.params)).toHaveLength(3);
      expect(query.params.id1).toMatchObject({ name: "id1" });
      expect(query.params.id2).toMatchObject({ name: "id2" });
      expect(query.params.email).toMatchObject({ name: "email" });
   });
});
