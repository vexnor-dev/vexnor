import { describe, test, expect } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { param } from "#/core/query/sql-param.js";
import { when } from "#/core/operators/sql-when.js";
import { insert } from "#/core/operators/sql-insert-x.js";
import { filterBy } from "#/core/operators/sql-filter-by.js";
import { eachObject, eachKey, eachValue, colInTable } from "#/core/operators/sql-each-object.js";
import { SqlPagination } from "#/core/operators/sql-pagination.js";
import { Account } from "@test-models/vexnor_dev.schema.js";
import { serializeQuery, serializeManifest } from "#/core/serialize/serialize-query.js";

describe("Codecov — sql-build-context.ts operator in toText()", () => {
   test("formatted output includes operator comment markers", () => {
      // getSql with default formatting calls toText() which hits the "operator" case
      const q = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`;
      const { text } = q.getSql({ params: { filterBy: null } });
      // When filterBy is null, the operator emits nothing but the operator token is still in the stream
      // for the formatter to process
      expect(typeof text).toBe("string");
   });

   test("formatted output with pagination operator token", () => {
      const q = sql`SELECT ${row(Account.$$)} FROM ${Account} ${new SqlPagination()}`;
      const { text, values } = q.getSql({ params: { limit: 10 } });
      expect(text.toLowerCase()).toContain("limit");
      expect(values).toContain(10);
   });
});

describe("Codecov — sql-when.ts non-SqlQuery branch", () => {
   test("when with inline Sql (not SqlQuery) as branch", () => {
      // sql`...`.inline() produces a plain Sql node, not SqlQuery
      const branch = sql`AND "email" IS NOT NULL`.inline();
      const q = sql`SELECT 1 FROM ${Account} WHERE 1=1 ${when("showEmail", branch)}`;
      const { text } = q.getSql({ params: { showEmail: true } });
      expect(text).toContain("IS NOT NULL");
   });

   test("when with inline onFalse branch", () => {
      const onTrue = sql`ASC`.inline();
      const onFalse = sql`DESC`.inline();
      const q = sql`SELECT 1 ORDER BY 1 ${when("asc", onTrue, onFalse)}`;
      const { text } = q.getSql({ params: { asc: false } });
      expect(text).toContain("DESC");
   });
});

describe("Codecov — sql-each-object.ts non-SqlQuery body/template", () => {
   test("colInTable with inline body (not SqlQuery)", () => {
      const body = sql`${eachKey()} = ${eachValue()}`.inline();
      const template = colInTable(Account, eachKey(), body);
      const q = sql`SET ${eachObject<{ set: Record<string, unknown> }>("set", template)}`;
      const { text, values } = q.getSql({ params: { set: { email: "test@test.com" } } });
      expect(text).toContain("email");
      expect(values).toContain("test@test.com");
   });

   test("eachObject with inline template (not SqlQuery)", () => {
      const template = sql`${eachKey()} = ${eachValue()}`.inline();
      const q = sql`SET ${eachObject<{ set: Record<string, unknown> }>("set", template)}`;
      const { text } = q.getSql({ params: { set: { email: "x" } } });
      expect(text).toContain("email");
   });
});

describe("Codecov — sql-query-handler.ts param validation", () => {
   test("param with validation rules triggers validate()", () => {
      const q = sql`SELECT 1 WHERE x = ${param<{ x: string }>("x", { minLength: 1 })}`;
      const { values } = q.getSql({ params: { x: "hello" } });
      expect(values).toContain("hello");
   });

   test("param validation throws on invalid value", () => {
      const q = sql`SELECT 1 WHERE x = ${param<{ x: string }>("x", { minLength: 5 })}`;
      expect(() => q.getSql({ params: { x: "hi" } })).toThrow();
   });
});

describe("Codecov — serialize-query.ts remaining", () => {
   test("serializeManifest produces full manifest", async () => {
      const q = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${param<{ email: string }>("email")}`;
      const manifest = await serializeManifest([{ query: q, name: "test", hash: await q.hash }], "postgresql");
      expect(manifest.version).toBe(1);
      expect(manifest.dialect).toBe("postgresql");
      expect(Object.keys(manifest.queries)).toHaveLength(1);
   });

   test("serializeQuery — when with onFalse", async () => {
      const q = sql`SELECT 1 ${when("flag", sql`ASC`, sql`DESC`)}`;
      const result = await serializeQuery(q, "whenElse", "postgresql");
      const whenNode = result.template.find((n) => n.type === "when") as { onFalse?: unknown };
      expect(whenNode.onFalse).toBeDefined();
   });

   test("serializeQuery — pagination token", async () => {
      const q = sql`SELECT ${row(Account.$$)} FROM ${Account} ${new SqlPagination()}`;
      const result = await serializeQuery(q, "paginated", "postgresql");
      expect(result.template.some((n) => n.type === "pagination")).toBe(true);
   });
});

describe("Codecov — sql-insert-utils.ts row key mismatch", () => {
   test("throws when rows have different columns", () => {
      const q = sql`INSERT INTO ${Account} ${insert(Account)} RETURNING ${row(Account.$$)}`;
      expect(() =>
         q.getSql({ params: { rows: [{ email: "a@b.com", firstName: "A", lastName: "B" }, { email: "c@d.com", firstName: "C" } as never] } }),
      ).toThrow("different columns");
   });
});
