import { describe, expect, test } from "vitest";
import { InferParamsFromQueryTokens, sql } from "../sql.js";
import { param, SqlParam } from "../query/index.js";
import { Account } from "./models/valnor_test.schema.js";
import { row } from "../query/index.js";
import { info } from "../charms/index.js";

describe("SqlQuery.params", () => {
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
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} in (${[param("id1"), param("id2"), param("id3")]})
      `;

      expect(query.params).toMatchObject({
         id1: { name: "id1" },
         id2: { name: "id2" },
         id3: { name: "id3" },
      });
      expect(Object.keys(query.params)).toHaveLength(3);
   });

   test("includes params from subqueries with arrays", () => {
      const subquery = sql`
         ${info({ label: "Subquery" })}
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} in (${[param("id1"), param("id2")]})
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
   });
});
