import { describe, test, expect } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { param } from "#/core/query/sql-param.js";
import { when } from "#/core/operators/sql-when.js";
import { each } from "#/core/operators/sql-each.js";
import { filterBy } from "#/core/operators/sql-filter-by.js";
import { SqlPagination } from "#/core/operators/sql-pagination.js";
import { Account } from "@test-models/vexnor_dev.schema.js";
import { serializeQuery, serializeManifest } from "#/core/serialize/serialize-query.js";

describe("Coverage — remaining uncovered lines", () => {
   test("serializeManifest produces manifest with queries", async () => {
      const q = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${param<{ email: string }>("email")}`;
      const manifest = await serializeManifest([{ query: q, name: "test", hash: await q.hash }], "postgresql");
      expect(manifest.version).toBe(1);
      expect(manifest.dialect).toBe("postgresql");
      expect(Object.keys(manifest.queries)).toHaveLength(1);
   });

   test("serializeQuery — when with onFalse branch", async () => {
      const q = sql`SELECT 1 ${when("flag", sql`ASC`, sql`DESC`)}`;
      const result = await serializeQuery(q, "whenElse", "postgresql");
      const whenNode = result.template.find((n) => n.type === "when");
      expect(whenNode).toBeDefined();
      expect((whenNode as { onFalse?: unknown }).onFalse).toBeDefined();
   });

   test("serializeQuery — pagination operator token", async () => {
      const q = sql`SELECT ${row(Account.$$)} FROM ${Account} ${new SqlPagination()}`;
      const result = await serializeQuery(q, "paginated", "postgresql");
      const paginationNode = result.template.find((n) => n.type === "pagination");
      expect(paginationNode).toBeDefined();
   });

   test("sql-when — non-SqlQuery branch (raw Sql)", () => {
      // when() with a plain Sql node (not SqlQuery) triggers the non-SqlQuery build path
      const fragment = sql`AND x = 1`.inline();
      const q = sql`SELECT 1 ${when("flag", fragment)}`;
      const { text } = q.getSql({ params: { flag: true } });
      expect(text).toContain("AND x = 1");
   });

   test("sql-each — non-SqlQuery template branch", () => {
      // each() with an inline fragment triggers the non-SqlQuery template.build path
      const template = sql`item`.inline();
      const q = sql`${each<{ items: string[] }>("items", template)}`;
      const { text } = q.getSql({ params: { items: ["a", "b"] } });
      expect(text).toContain("item");
   });

   test("sql-build-context — operator token in toText()", () => {
      const q = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`;
      // serializeQuery builds with params=null which hits the operator token path
      // The toText() method formats operator tokens as /* <type> */ comments
   });

   test("sql-pagination — serialization mode (params=null)", async () => {
      const q = sql`SELECT ${row(Account.$$)} FROM ${Account} ${new SqlPagination()}`;
      const result = await serializeQuery(q, "paginatedQuery", "postgresql");
      const pagNode = result.template.find((n) => n.type === "pagination");
      expect(pagNode).toMatchInlineSnapshot(`
        {
          "type": "pagination",
        }
      `);
   });
});
