import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { info } from "#/core/charms/sql-query-info.js";

describe("SqlBuildContext.addQuery()", () => {
   test("happy path: registers a new query with auto-generated name and cte=false", () => {
      const query = sql`SELECT 1`;
      const context = new SqlBuildContext();

      const result = context.addQuery(query);

      expect(result).toMatchObject({ index: 0, name: "query_0" });
      expect(context.isCTE(query)).toBe(false);
      expect(context.queries.size).toBe(1);
   });

   test("happy path: uses info.label as name when present", () => {
      const query = sql`${info({ label: "MyQuery" })} SELECT 1`;
      const context = new SqlBuildContext();

      const result = context.addQuery(query);

      expect(result).toMatchObject({ name: "MyQuery" });
      expect(context.isCTE(query)).toBe(false);
   });

   test("happy path: registers with cte=true when override is provided", () => {
      const query = sql`SELECT 1`;
      const context = new SqlBuildContext();

      context.addQuery(query, { cte: true });

      expect(context.isCTE(query)).toBe(true);
   });

   test("happy path: sequential indices for multiple distinct queries", () => {
      const q1 = sql`${info({ label: "A" })} SELECT 1`;
      const q2 = sql`${info({ label: "B" })} SELECT 2`;
      const context = new SqlBuildContext();

      context.addQuery(q1);
      context.addQuery(q2);

      expect(context.queries.get(q1.id)).toMatchObject({ index: 0, name: "A" });
      expect(context.queries.get(q2.id)).toMatchObject({ index: 1, name: "B" });
   });

   test("happy path: returns the registered entry", () => {
      const query = sql`SELECT 1`;
      const context = new SqlBuildContext();

      const result = context.addQuery(query);

      expect(result).toBe(context.queries.get(query.id));
   });

   test("edge case: re-adding existing query merges override (cte=false -> cte=true)", () => {
      const query = sql`SELECT 1`;
      const context = new SqlBuildContext();
      context.addQuery(query, { cte: false });

      context.addQuery(query, { cte: true });

      expect(context.isCTE(query)).toBe(true);
      expect(context.queries.size).toBe(1);
   });

   test("edge case (BUG): re-adding existing query with no override keeps cte=true", () => {
      const query = sql`SELECT 1`;
      const context = new SqlBuildContext();
      context.addQuery(query, { cte: true });
      context.addQuery(query);
      expect(context.isCTE(query)).toBe(true);
   });

   test("edge case: re-adding existing query does not change index or name", () => {
      const query = sql`${info({ label: "Stable" })} SELECT 1`;
      const context = new SqlBuildContext();
      context.addQuery(query);

      context.addQuery(query, { cte: true });

      expect(context.queries.get(query.id)).toMatchObject({ index: 0, name: "Stable" });
   });

   test("edge case: recursively registers internalQueries with sequential indices", () => {
      const inner = sql`${info({ label: "Inner" })} SELECT 1`;
      const outer = sql`${info({ label: "Outer" })} SELECT ${inner}`;
      const context = new SqlBuildContext();

      context.addQuery(outer);

      expect(context.queries.get(outer.id)).toMatchObject({ index: 0, name: "Outer" });
      expect(context.queries.get(inner.id)).toMatchObject({ index: 1, name: "Inner" });
      expect(context.isCTE(outer)).toBe(false);
      expect(context.isCTE(inner)).toBe(false);
   });

   test("edge case: already-registered nested query is skipped during recursion", () => {
      const inner = sql`${info({ label: "Inner" })} SELECT 1`;
      const outer = sql`${info({ label: "Outer" })} SELECT ${inner}`;
      const context = new SqlBuildContext();
      context.addQuery(inner); // pre-register inner at index 0

      context.addQuery(outer); // outer gets index 1, inner is skipped

      expect(context.queries.get(inner.id)).toMatchObject({ index: 0, name: "Inner" });
      expect(context.queries.get(outer.id)).toMatchObject({ index: 1, name: "Outer" });
      expect(context.queries.size).toBe(2);
   });
});
