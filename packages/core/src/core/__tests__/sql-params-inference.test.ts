import { assertType, describe, expect, test } from "vitest";
import { sql, row, param, orderBy, filterBy, insert, set, when } from "#src/core/core.js";
import { ParamsOf } from "#src/core/sql-base.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";

describe("ParamsOf inference with new operators", () => {
   test("param only", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${param("accountId")}`;
      type P = ParamsOf<typeof query>;
      assertType<P>({ accountId: "" });
   });

   test("orderBy infers orderBy param", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${orderBy(Account)}`;
      type P = ParamsOf<typeof query>;
      assertType<P>({ orderBy: { createdAt: "DESC" } });
   });

   test("filterBy infers filterBy param", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`;
      type P = ParamsOf<typeof query>;
      assertType<P>({ filterBy: { email: "test" } });
   });

   test("insert infers rows param", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sql`INSERT INTO ${Account} ${insert(Account)} RETURNING ${row(Account.$$)}`;
      type P = ParamsOf<typeof query>;
      assertType<P>({ rows: [{ email: "a", firstName: "A", lastName: "B" }] });
   });

   test("set infers set param", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sql`UPDATE ${Account} ${set(Account)} WHERE ${Account.$accountId} = ${param("accountId")}`;
      type P = ParamsOf<typeof query>;
      assertType<P>({ set: { email: "new" }, accountId: "" });
   });

   test("when infers unknown param truthy", () => {
      const filterByEmail = when("email", sql`AND ${Account.$email} = ${param<{ email: string }>("email")}`);
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${filterByEmail}`;
      type P = ParamsOf<typeof query>;
      assertType<P>({ email: "" });
   });


   test("when infers boolean param", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${when("hasEmail", sql`AND ${Account.$email} = ${param<{ email: string }>("email")}`)}`;
      type P = ParamsOf<typeof query>;
      assertType<P>({ hasEmail: true, email: "" });
   });

   test("when rejects missing flag param", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${when("hasEmail", sql`AND ${Account.$email} = ${param<{ email: string }>("email")}`)}`;
      type P = ParamsOf<typeof query>;
      assertType<P>({ email: "" });
   });

   test("when rejects missing branch param", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${when("hasEmail", sql`AND ${Account.$email} = ${param<{ email: string }>("email")}`)}`;
      type P = ParamsOf<typeof query>;
      // @ts-expect-error — missing email
      assertType<P>({ hasEmail: true });
   });

   test("when rejects empty object", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${when("hasEmail", sql`AND ${Account.$email} = ${param<{ email: string }>("email")}`)}`;
      type P = ParamsOf<typeof query>;
      // @ts-expect-error — empty object missing all params
      assertType<P>({});
   });

   test("when rejects extra unknown params", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${when("hasEmail", sql`AND ${Account.$email} = ${param<{ email: string }>("email")}`)}`;
      type P = ParamsOf<typeof query>;
      // @ts-expect-error — unknown extra param
      assertType<P>({ hasEmail: true, email: "", unknownField: "x" });
   });

   test("combined operators", () => {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE ${filterBy(Account)}
         ${orderBy(Account)}
         ${when("hasLimit", sql`LIMIT ${param("limit")}`)}
      `;
      type P = ParamsOf<typeof query>;
      assertType<P>({ filterBy: [{ status: ["=", "active"] }], orderBy: { email: "ASC" }, hasLimit: true, limit: 10 });
   });
});

describe("ParamsOf with nested dot-path params", () => {
   test("param with dot-path resolves nested structure", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${param<{ test: { paramA: { value: string } } }>("test.paramA.value")}`;
      type P = ParamsOf<typeof query>;
      assertType<P>({ test: { paramA: { value: "uuid" } } });
   });

   test("param with dot-path rejects flat shape", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${param<{ test: { paramA: { value: string } } }>("test.paramA.value")}`;
      type P = ParamsOf<typeof query>;
      // @ts-expect-error — flat key not allowed
      assertType<P>({ "test.paramA.value": "uuid" });
   });

   test("param with dot-path rejects missing nested level", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${param<{ test: { paramA: { value: string } } }>("test.paramA.value")}`;
      type P = ParamsOf<typeof query>;
      // @ts-expect-error — missing inner level
      assertType<P>({ test: { paramA: {} } });
   });

   test("when with dot-path flag name", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${when("filters.hasEmail", sql`AND ${Account.$email} = ${param<{ filters: { email: string } }>("filters.email")}`)}`;
      type P = ParamsOf<typeof query>;
      assertType<P>({ filters: { hasEmail: true, email: "test@x.com" } });
   });

   test("when with dot-path rejects missing nested flag", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${when("filters.hasEmail", sql`AND ${Account.$email} = ${param<{ filters: { email: string } }>("filters.email")}`)}`;
      type P = ParamsOf<typeof query>;
      assertType<P>({ filters: { email: "test" } });
   });

   test("when with negated dot-path flag", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${when("filters.!disabled", sql`AND ${Account.$status} = ${"active"}`)}`;
      type P = ParamsOf<typeof query>;
      assertType<P>({ filters: { "!disabled": true } });
   });

   test("multiple dot-path params combine correctly", () => {
      const query = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE ${Account.$email} = ${param<{ search: { email: string } }>("search.email")}
         AND ${Account.$status} = ${param<{ search: { status: string } }>("search.status")}
      `;
      type P = ParamsOf<typeof query>;
      assertType<P>({ search: { email: "x", status: "active" } });
   });

   test("multiple dot-path params reject partial", () => {
      const query = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE ${Account.$email} = ${param<{ search: { email: string } }>("search.email")}
         AND ${Account.$status} = ${param<{ search: { status: string } }>("search.status")}
      `;
      type P = ParamsOf<typeof query>;
      // @ts-expect-error — missing search.status
      assertType<P>({ search: { email: "x" } });
   });
});

describe("ParamsOf with dot-path operator names", () => {
   test("filterBy with dot-path emits nested param structure", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account, "account.filterBy")}`;
      type P = ParamsOf<typeof query>;
      assertType<P>({ account: { filterBy: { email: "test" } } });
   });

   test("filterBy with dot-path rejects flat key", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account, "account.filterBy")}`;
      type P = ParamsOf<typeof query>;
      // @ts-expect-error — flat key not allowed
      assertType<P>({ "account.filterBy": { email: "test" } });
   });

   test("orderBy with dot-path emits nested param structure", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${orderBy(Account, "account.orderBy")}`;
      type P = ParamsOf<typeof query>;
      assertType<P>({ account: { orderBy: { createdAt: "DESC" } } });
   });

   test("orderBy with dot-path rejects flat key", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${orderBy(Account, "account.orderBy")}`;
      type P = ParamsOf<typeof query>;
      // @ts-expect-error — flat key not allowed
      assertType<P>({ "account.orderBy": { createdAt: "DESC" } });
   });

   test("combined dot-path operators merge into same namespace", () => {
      const query = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE ${filterBy(Account, "account.filterBy")}
         ${orderBy(Account, "account.orderBy")}
      `;
      type P = ParamsOf<typeof query>;
      assertType<P>({ account: { filterBy: { email: "x" }, orderBy: { createdAt: "ASC" } } });
   });

   test("combined dot-path rejects missing sibling", () => {
      const query = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE ${filterBy(Account, "account.filterBy")}
         ${orderBy(Account, "account.orderBy")}
      `;
      type P = ParamsOf<typeof query>;
      assertType<P>({ account: { filterBy: { email: "x" } } });
   });
});

describe("Runtime query.params with dot-path names", () => {
   test("filterBy with dot-path has param name in dot notation", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account, "account.filterBy")}`;
      const paramNames = Object.values(query.params ?? {}).map((p: any) => p?.name ?? Object.values(p ?? {}).map((x: any) => x?.name)).flat();
      expect(paramNames).toContain("account.filterBy");
   });

   test("orderBy with dot-path has param name in dot notation", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${orderBy(Account, "account.orderBy")}`;
      const paramNames = Object.values(query.params ?? {}).map((p: any) => p?.name ?? Object.values(p ?? {}).map((x: any) => x?.name)).flat();
      expect(paramNames).toContain("account.orderBy");
   });

   test("when with dot-path has param name in dot notation", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${when("flags.hasEmail", sql`AND ${Account.$email} = ${param<{ flags: { email: string } }>("flags.email")}`)}`;
      const params = query.params as Record<string, any>;
      const allNames = Object.values(params).map((p: any) => p?.name).filter(Boolean);
      expect(allNames).toContain("flags.hasEmail");
      expect(allNames).toContain("flags.email");
   });

   test("runtime resolvePath works for dot-path filterBy", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account, "account.filterBy")}`;
      const result = query.getSql({
         params: { account: { filterBy: { email: "test@x.com" } } },
         options: { dialect: "postgresql", format: false },
      });
      expect(result.values).toMatchInlineSnapshot(`
        [
          "test@x.com",
        ]
      `);
   });

   test("runtime resolvePath works for dot-path orderBy", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} ${orderBy(Account, "account.orderBy")}`;
      const result = query.getSql({
         params: { account: { orderBy: { createdAt: "DESC" } } },
         options: { dialect: "postgresql", format: false },
      });
      expect(result.text).toContain("order by");
      expect(result.text).toContain("DESC");
   });

   test("runtime resolvePath works for dot-path when + param", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE 1=1 ${when("flags.hasEmail", sql`AND ${Account.$email} = ${param<{ flags: { email: string } }>("flags.email")}`)}`;
      const result = query.getSql({
         params: { flags: { hasEmail: true, email: "deep@test.com" } },
         options: { dialect: "postgresql", format: false },
      });
      expect(result.values).toContain("deep@test.com");
   });
});
