import { describe, test, expect } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { param } from "#/core/query/sql-param.js";
import { raw } from "#/core/query/sql-raw.js";
import { when } from "#/core/operators/sql-when.js";
import { each, SqlEachIt } from "#/core/operators/sql-each.js";
import { insert } from "#/core/operators/sql-insert-x.js";
import { filterBy } from "#/core/operators/sql-filter-by.js";
import { eachObject, eachKey, eachValue, colInTable } from "#/core/operators/sql-each-object.js";
import { SqlPagination } from "#/core/operators/sql-pagination.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { Account } from "@test-models/vexnor_dev.schema.js";
import { serializeQuery, serializeManifest } from "#/core/serialize/serialize-query.js";

// raw() returns a Sql (NOT SqlQuery) — this is needed to hit the else branches

describe("sql-build-context.ts — operator token in text getter", () => {
   test("context.text includes operator comment when built with null params", () => {
      const q = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`;
      const context = new SqlBuildContext({ dialect: "postgresql", params: null });
      q.build(context, null, { queryType: "main" });
      expect(context.text).toContain("/* <filter> */");
   });
});

describe("sql-when.ts — non-SqlQuery else branch (line 137)", () => {
   test("when() with raw() as onTrue branch", () => {
      const q = sql`SELECT 1 ${when("flag", raw("AND x = 1"))}`;
      const { text } = q.getSql({ params: { flag: true } });
      expect(text).toContain("AND x = 1");
   });

   test("when() with raw() as onFalse branch", () => {
      const q = sql`SELECT 1 ${when("flag", raw("ASC"), raw("DESC"))}`;
      const { text } = q.getSql({ params: { flag: false } });
      expect(text).toContain("DESC");
   });
});

describe("sql-each.ts — non-SqlQuery else branch (line 98)", () => {
   test("each() with SqlEachIt as template (plain Sql)", () => {
      const q = sql`VALUES ${each<{ items: string[] }>("items", new SqlEachIt())}`;
      const { values } = q.getSql({ params: { items: ["a", "b", "c"] } });
      expect(values).toHaveLength(3);
   });
});

describe("sql-each-object.ts — non-SqlQuery else branches (lines 131, 224)", () => {
   test("colInTable body is raw() (plain Sql) — line 131", () => {
      const body = raw("1");
      const template = colInTable(Account, eachKey(), body);
      const q = sql`${eachObject<{ set: Record<string, unknown> }>("set", template)}`;
      const { text } = q.getSql({ params: { set: { email: "x" } } });
      expect(text).toContain("1");
   });

   test("eachObject template is eachValue() (plain Sql) — line 224", () => {
      const q = sql`${eachObject<{ set: Record<string, unknown> }>("set", eachValue())}`;
      const { values } = q.getSql({ params: { set: { email: "test" } } });
      expect(values).toContain("test");
   });
});

describe("sql-query-handler.ts — param validation (line 266)", () => {
   test("param with validation triggers validate()", () => {
      const q = sql`SELECT 1 WHERE x = ${param<{ x: string }>("x", { minLength: 1 })}`;
      const { values } = q.getSql({ params: { x: "hello" } });
      expect(values).toContain("hello");
   });

   test("param validation throws on invalid value", () => {
      const q = sql`SELECT 1 WHERE x = ${param<{ x: string }>("x", { minLength: 5 })}`;
      expect(() => q.getSql({ params: { x: "hi" } })).toThrow();
   });
});

describe("serialize-query.ts — remaining paths", () => {
   test("serializeManifest", async () => {
      const q = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const manifest = await serializeManifest([{ query: q, name: "t", hash: await q.hash }], "postgresql");
      expect(manifest.version).toBe(1);
      expect(Object.keys(manifest.queries)).toHaveLength(1);
   });

   test("when with onFalse serialization", async () => {
      const q = sql`SELECT 1 ${when("f", sql`ASC`, sql`DESC`)}`;
      const r = await serializeQuery(q, "w", "postgresql");
      const n = r.template.find((t) => t.type === "when") as { onFalse?: unknown };
      expect(n.onFalse).toBeDefined();
   });

   test("pagination serialization", async () => {
      const q = sql`SELECT 1 ${new SqlPagination()}`;
      const r = await serializeQuery(q, "p", "postgresql");
      expect(r.template.some((t) => t.type === "pagination")).toBe(true);
   });
});

describe("sql-insert-utils.ts — row key mismatch", () => {
   test("throws when rows have different columns", () => {
      const q = sql`INSERT INTO ${Account} ${insert(Account)} RETURNING ${row(Account.$$)}`;
      expect(() =>
         q.getSql({ params: { rows: [{ email: "a", firstName: "A", lastName: "B" }, { email: "b", firstName: "C" } as never] } }),
      ).toThrow("different columns");
   });
});
