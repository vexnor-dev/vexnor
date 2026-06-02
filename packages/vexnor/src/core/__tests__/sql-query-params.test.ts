import { assertType, describe, expect, test } from "vitest";
import { SqlParams, sql } from "#/core/sql.js";
import { param, SqlParam } from "#/core/query/sql-param.js";
import { SqlInputArgs } from "#/core/query/sql-query-types.js";
import { SqlQueryExtended } from "#/core/query/sql-query.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account, AccountStatusUdt, IAccountSelect } from "@test-models//vexnor_dev.schema.js";
import { info } from "#/core/charms/sql-query-info.js";
import { ParamsOf } from "#/core/sql-base.js";
import { Simplify, Void } from "#/core/utils/utility-types.js";

describe("SqlQuery.params", () => {
   test("Infer params from sql-query", () => {
      type FullParams = SqlParams<
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
         id1: 0,
         id2: 0,
         id3: 0,
         // @ts-expect-error - Testing runtime validation of extra property
         id4: 0,
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

      type EmptyParams = SqlParams<[typeof Account, typeof Account.$$, typeof Account.$accountId]>;
      assertType<EmptyParams>(void 0);
      type EmptyInputArgs = SqlInputArgs<EmptyParams>;
      assertType<EmptyInputArgs>({});
   });

   test("InferParamsFromQueryTokens from sql-query with tokens and params", () => {
      type Params = SqlParams<
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
      type Params = SqlParams<
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
      type Params = SqlParams<[typeof Account, typeof Account.$$, typeof Account.$accountId]>;
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
      assertType<ParamsOf<typeof query>>({
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

      assertType<ParamsOf<typeof query>>(void 0);
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

      assertType<ParamsOf<typeof query>>({
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

      assertType<SqlQueryExtended<{ Row: IAccountSelect; Params: { email: string; accountId: string } }>>(query);

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

      assertType<SqlQueryExtended<{ Params: { id1: string; id2: string; id3: string }; Row: IAccountSelect }>>(query);

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

   test(`SqlParams<void & {...}> should return {...}`, () => {
      assertType<Simplify<void & { name: string }>>({ name: "a" });
      assertType<Void<void & { name: string }>>({ name: "a" });
   });

   test("normalizes missing optional param to null", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$email} = ${param<{ email?: string }>("email")}
      `;

      const { values: missingValues } = query.getSql({ params: {} });
      const { values: undefinedValues } = query.getSql({ params: { email: undefined } });

      expect(missingValues).toEqual([null]);
      expect(undefinedValues).toEqual([null]);
   });

   test("applies param validation rules", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$email} = ${param<{ email: string }>("email", {
            minLength: 5,
            pattern: /@/,
         })}
      `;

      expect(() => query.getSql({ params: { email: "x" } })).toThrow("Invalid param 'email'");
      expect(() => query.getSql({ params: { email: "a@b.c" } })).not.toThrow();
   });

   test("uses custom validation message", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} = ${param<{ accountId: string }>("accountId", {
            validate: (value) => (typeof value === "string" && value.startsWith("acc_") ? true : "must start with acc_"),
         })}
      `;

      expect(() => query.getSql({ params: { accountId: "123" } })).toThrow("must start with acc_");
   });

   test("uses declared default when param is not provided", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$status} = ${param<{ status?: string }>("status", { default: "ACTIVE" })}
      `;

      const { text, values: missingValues } = query.getSql({ params: {} });
      const { values: undefinedValues } = query.getSql({ params: { status: undefined } });
      const { values: explicitValues } = query.getSql({ params: { status: "CONFIRMED" } });

      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
        WHERE
          "a_1"."status" = ?
          /* </query_0> */"
      `);
      expect(missingValues).toEqual(["ACTIVE"]);
      expect(undefinedValues).toEqual(["ACTIVE"]);
      expect(explicitValues).toEqual(["CONFIRMED"]);
   });

   test("null is not replaced by default", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$status} = ${param<{ status?: string }>("status", { default: "ACTIVE" })}
      `;

      // @ts-expect-error - null is not assignable to optional string, testing runtime behaviour
      const { values } = query.getSql({ params: { status: null } });
      expect(values).toEqual([null]);
   });

   test("invalid value with default falls back to default silently", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         order by ${param<{ sort: string }>("sort", { values: ["email", "createdAt"], default: "createdAt" })}
      `;

      const { values } = query.getSql({ params: { sort: "invalid" } });
      expect(values).toEqual(["createdAt"]);
   });

   test("invalid value without default throws", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         order by ${param<{ sort: string }>("sort", { values: ["email", "createdAt"] })}
      `;

      expect(() => query.getSql({ params: { sort: "invalid" } })).toThrow("Invalid param 'sort'");
   });

   test("same param used multiple times emits repeated placeholders and values", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
            or ${Account.$parentId} = ${param<{ accountId: string }>("accountId")}
      `;

      const { text, values } = query.getSql({ params: { accountId: "123" } });

      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
        WHERE
          "a_1"."account_id" = ?
          OR "a_1"."parent_id" = ?
          /* </query_0> */"
      `);
      expect(values).toEqual(["123", "123"]);
      expect(Object.keys(query.params)).toHaveLength(1);
   });
});
