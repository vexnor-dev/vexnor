import { describe, expect, test } from "vitest";
import { InferParamFromSql, InferParamsFromQueryTokens, QueryParams, sql } from "../sql.js";
import { param, row, SqlInputArgs, SqlParam, SqlQueryExtended } from "../query/index.js";
import { Account, AccountStatusUdt } from "./models/valnor_test.schema.js";
import { info } from "../charms/index.js";

describe("SqlQuery.params", () => {
   test("InferParamFromSql<SqlParam>", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const id1 = param("id1").is<string>();
      type Params = InferParamFromSql<typeof id1>;
      const params: Params = {
         id1: "",
         // @ts-expect-error - Testing runtime validation of extra property
         test: "a",
      };
      expect(params.id1).toBeDefined();
   });

   test("InferParamFromSql<SqlQuery>", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const id1 = sql`${param("id1")}`;
      type Params = InferParamFromSql<typeof id1>;
      const params: Params = {
         id1: "",
         // @ts-expect-error - Testing runtime validation of extra property
         test: "a",
      };
      expect(params.id1).toBeDefined();
      // @ts-expect-error - Testing runtime validation of extra property
      expect(params.test1).toBeUndefined();
   });

   test("Infer params from sql-query", () => {
      type FullParams = InferParamsFromQueryTokens<
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

      const fullParams: FullParams = {
         accountId: "",
         modifiedAt: new Date(),
         limit: 5,
         id1: 1,
         id2: 2,
         id3: 3,
         // @ts-expect-error - Testing runtime validation of extra property
         id4: 4,
      };
      expect(fullParams).toBeDefined();

      type FullInputArgs = SqlInputArgs<FullParams>;

      const fullInputArgs: FullInputArgs = {
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
      };
      expect(fullInputArgs).toBeDefined();

      type EmptyParams = QueryParams<[typeof Account, typeof Account.$$, typeof Account.$accountId]>;
      const emptyParams: EmptyParams = void 0;
      expect(emptyParams).toBeUndefined();
      type EmptyInputArgs = SqlInputArgs<EmptyParams>;
      const emptyInputArgs: EmptyInputArgs = {};
      expect(emptyInputArgs).toBeDefined();
   });

   test("InferParamsFromQueryTokens from sql-query with tokens and params", () => {
      type Params = InferParamsFromQueryTokens<
         [
            typeof Account,
            typeof Account.$$,
            typeof Account.$accountId,
            SqlParam<{ Name: "accountId"; Type: string }>,
            SqlParam<{ Name: "createdAt"; Type: Date }>,
         ]
      >;
      const params: Params = {
         accountId: "",
         createdAt: new Date(),
      };
      expect(params).toBeDefined();
      expect(params.accountId).toBeDefined();
      expect(params.createdAt).toBeDefined();
      // @ts-expect-error - Testing runtime validation of missing property
      expect(params.status).toBeUndefined();
   });

   test("InferParamsFromQueryTokens from sql-query with tokens and params incl. array", () => {
      type Params = InferParamsFromQueryTokens<
         [
            typeof Account,
            typeof Account.$$,
            typeof Account.$accountId,
            SqlParam<{ Name: "accountId"; Type: string }>,
            [SqlParam<{ Name: "createdAt"; Type: Date }>, SqlParam<{ Name: "modifiedAt"; Type: Date }>],
         ]
      >;
      const params: Params = {
         accountId: "",
         createdAt: new Date(),
         modifiedAt: new Date(),
         // @ts-expect-error - Testing runtime validation of missing property
         status: "",
      };
      expect(params).toBeDefined();
      expect(params.accountId).toBeDefined();
      expect(params.createdAt).toBeDefined();
      expect(params.modifiedAt).toBeDefined();
      // @ts-expect-error - Testing runtime validation of missing property
      expect(params.email).toBeUndefined();
   });

   test("InferParamsFromQueryTokens from sql-query without any params", () => {
      type Params = InferParamsFromQueryTokens<[typeof Account, typeof Account.$$, typeof Account.$accountId]>;
      const params: Params = null; /* unknown */
      expect(params).toBeNull();
   });

   test("extracts params from query", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$email} = ${param("email")}
           and ${Account.$accountId} = ${param("accountId")}
      `;

      expect(query.params).toMatchObject({
         email: { name: "email" },
         accountId: { name: "accountId" },
      });
      expect(Object.keys(query.params)).toHaveLength(2);
      expect(query.params.email).toMatchObject({ name: "email" });
      expect(query.params.accountId).toMatchObject({ name: "accountId" });
      // @ts-expect-error - Testing runtime validation of missing property
      expect(query.params.status).toBeUndefined();
   });

   test("returns empty object when no params", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
      `;

      expect(query.params).toBeNull();
      // @ts-expect-error - Testing runtime validation of missing property
      expect(query.params?.accountId).toBeUndefined();
   });

   test("handles duplicate params", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$email} = ${param("email")}
            or ${Account.$email} = ${param("email")}
      `;

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
         where ${Account.$email} = ${param("email")}
      `;

      const query = sql`
         select ${row(subquery.$$)}
         from ${subquery}
         where ${subquery.$accountId} = ${param("accountId")}
      `;

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
         select ${Account.$$}
         from ${Account}
         where ${Account.$accountId} in (${param("id1").is<string>()}, ${param("id2").is<string>()}, ${param("id3").is<string>()})
           and ${Account.$status} = ${param("status").is<AccountStatusUdt>()}
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
         where ${Account.$accountId} in (${param("id1")}, ${param("id2")})
         and ${Account.$status} = ${AccountStatusUdt.CONFIRMED}
      `;

      const query = sql`
         select ${row(subquery.$$)}
         from ${subquery}
         where ${subquery.$email} = ${param("email")}
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
