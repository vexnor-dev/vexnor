import { describe, expect, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { param } from "#src/core/query/sql-param.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlQuery } from "#src/core/query/sql-query.js";

describe("SqlQuery — write() method", () => {
   test("write wraps query with comment markers and query name", () => {
      const q = sql`SELECT 1`;
      const ctx = new SqlBuildContext({});
      q.write(ctx, null);
      expect(ctx.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          1 /* </query_0> */"
      `);
   });

   test("write with full query including table and row", () => {
      const q = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const ctx = new SqlBuildContext({ dialect: "sql" });
      q.write(ctx, null);
      expect(ctx.text).toMatchInlineSnapshot(`
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
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });

   test("write handles array values (comma-separated)", () => {
      const items = [sql`1`, sql`2`, sql`3`];
      const q = sql`SELECT ${items}`;
      const ctx = new SqlBuildContext({});
      q.write(ctx, null);
      expect(ctx.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          (/* <query_1> */ 1 /* </query_1> */) AS "query_1",
          (/* <query_2> */ 2 /* </query_2> */) AS "query_2",
          (/* <query_3> */ 3 /* </query_3> */) AS "query_3" /* </query_0> */"
      `);
   });
});

describe("SqlQuery — getSql() error branches", () => {
   test("throws SqlBuildError for non-primitive value token", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = sql`SELECT ${({ obj: true }) as any}`;
      expect(() => q.getSql({} as never)).toThrow("Unexpected non-primitive value token");
   });

   test("throws when param not provided", () => {
      const q = sql`SELECT ${param<{ id: string }>("id")}`;
      expect(() => q.getSql({} as never)).toThrow("Param value not provided");
   });

   test("handles array param values (expands to multiple placeholders)", () => {
      const q = sql`SELECT * FROM account WHERE id IN (${param<{ ids: string[] }>("ids")})`;
      const result = q.getSql({ params: { ids: ["a", "b", "c"] } });
      expect(result.values).toMatchInlineSnapshot(`
        [
          "a",
          "b",
          "c",
        ]
      `);
      expect(result.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          *
        FROM
          account
        WHERE
          id IN (?, ?, ?) /* </query_0> */"
      `);
   });

   test("format:auto uses formatter when available", () => {
      const q = sql`SELECT 1`;
      const result = q.getSql({ options: { format: "auto" } });
      expect(result.text).toBeDefined();
   });
});

describe("SqlQuery — authorize()", () => {
   test("authorize creates a clone with authorization tag", () => {
      const q = sql`DELETE FROM account`;
      const authorized = q.authorize("admin");
      expect(authorized.authorization).toMatchInlineSnapshot(`
        [
          "admin",
        ]
      `);
      expect(q.authorization).toEqual([]);
   });
});

describe("SqlQuery — render() and inline()", () => {
   test("render returns a query ref with specified format", () => {
      const q = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const ref = q.render("with");
      expect(ref).toBeDefined();
   });

   test("inline returns a query ref with inline type", () => {
      const q = sql`SELECT 1`;
      const ref = q.inline();
      expect(ref).toBeDefined();
   });
});

describe("SqlQuery — rowType getter", () => {
   test("rowType throws — it's type-only", () => {
      const q = sql`SELECT 1`;
      expect(() => q.rowType).toThrow("this property is only for fetching the row type");
   });
});

describe("SqlQuery — getContext()", () => {
   test("getContext returns empty for query with no parameters", () => {
      const q = sql`SELECT 1`;
      expect(q.getContext({} as never)).toMatchInlineSnapshot(`{}`);
   });

   test("getContext throws for null args", () => {
      const q = sql`SELECT ${param<{ id: string }>("id")}`;
      expect(() => q.getContext(null as never)).toThrow("Cannot get context for query with no arguments");
   });
});

describe("SqlQuery — buildInnerQueryRef error", () => {
   test("throws for unsupported query ref type", () => {
      const ctx = new SqlBuildContext({});
      expect(() => {
         SqlQuery.buildInnerQueryRef({} as never, ctx);
      }).toThrow();
   });
});

describe("SqlQuery.buildInnerToken", () => {
   test("handles falsy token (null)", () => {
      const ctx = new SqlBuildContext({});
      SqlQuery.buildInnerToken(null, ctx);
      expect(ctx.tokens).toMatchInlineSnapshot(`
        [
          {
            "type": "value",
            "value": null,
          },
        ]
      `);
   });

   test("handles primitive token", () => {
      const ctx = new SqlBuildContext({});
      SqlQuery.buildInnerToken(42, ctx);
      expect(ctx.tokens).toMatchInlineSnapshot(`
        [
          {
            "type": "value",
            "value": 42,
          },
        ]
      `);
   });
});
