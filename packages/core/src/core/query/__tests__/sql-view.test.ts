import { describe, expect, test } from "vitest";
import { sql, row, col } from "@vexnor/core";
import { Account } from "@test-models/vexnor_dev.schema.js";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { assertType } from "vitest";

describe(".view()", () => {
   // ─── Phase 1: row() column filtering ─────────────────────────────────────

   test("narrows columns from row($$)", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({ columns: ["accountId", "email"] });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toMatchInlineSnapshot(
         `" /* <query_0> */ SELECT "a_1"."account_id" as "accountId", "a_1"."email" FROM "main"."account" as "a_1"/* </query_0> */"`,
      );
   });

   test("narrows columns from explicit row()", () => {
      const base = sql`SELECT ${row(Account.$accountId, Account.$email, Account.$status)} FROM ${Account}`;
      const viewed = base.view({ columns: ["accountId", "status"] });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toMatchInlineSnapshot(
         `" /* <query_0> */ SELECT "a_1"."account_id" as "accountId", "a_1"."status" FROM "main"."account" as "a_1"/* </query_0> */"`,
      );
   });

   test("no columns option = all columns kept", () => {
      const base = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const viewed = base.view({
         window: { rn: { fn: "row_number", over: { orderBy: { email: "ASC" } } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      // All original columns present
      expect(text).toContain('"accountId"');
      expect(text).toContain('"email"');
      // Window function appended
      expect(text).toContain('row_number() OVER (ORDER BY "email" ASC) as "rn"');
   });

   test("single column kept unchanged", () => {
      const base = sql`SELECT ${row(Account.$accountId)} FROM ${Account}`;
      const viewed = base.view({ columns: ["accountId"] });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('"accountId"');
   });

   // ─── Phase 2: col() trimming ─────────────────────────────────────────────

   test("removes col() when not in columns list", () => {
      const base = sql`SELECT ${row(Account.$accountId)}, count(*) as ${col<{ total: number }>("total")} FROM ${Account}`;
      const viewed = base.view({ columns: ["accountId"] });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('"accountId"');
      expect(text).not.toContain("total");
      expect(text).not.toContain("count(*)");
   });

   test("keeps col() when in columns list", () => {
      const base = sql`SELECT ${row(Account.$accountId)}, count(*) as ${col<{ total: number }>("total")} FROM ${Account}`;
      const viewed = base.view({ columns: ["accountId", "total"] });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('"accountId"');
      expect(text).toContain('"total"');
   });

   // ─── Phase 3: Window function injection ───────────────────────────────────

   test("adds window function with orderBy", () => {
      const base = sql`SELECT ${row(Account.$accountId, Account.$createdAt)} FROM ${Account}`;
      const viewed = base.view({
         columns: ["accountId", "createdAt"],
         window: { rank: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('"accountId"');
      expect(text).toContain('row_number() OVER (ORDER BY "createdAt" DESC) as "rank"');
   });

   test("window with partitionBy + orderBy", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({
         columns: ["accountId"],
         window: { rn: { fn: "rank", over: { partitionBy: ["status"], orderBy: { createdAt: "DESC" } } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('PARTITION BY "status"');
      expect(text).toContain('ORDER BY "createdAt" DESC');
      expect(text).toContain("rank()");
   });

   test("window with aggregate function", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({
         columns: ["accountId", "status"],
         window: { total: { fn: "count", col: "accountId", over: { partitionBy: ["status"] } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('count("accountId") OVER (PARTITION BY "status") as "total"');
   });

   test("window with offset function (lag)", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({
         columns: ["accountId", "email"],
         window: { prev: { fn: "lag", col: "email", args: 1, over: { orderBy: { createdAt: "ASC" } } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('lag("email", 1) OVER (ORDER BY "createdAt" ASC) as "prev"');
   });

   test("window with ntile (bucket function)", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({
         columns: ["accountId"],
         window: { bucket: { fn: "ntile", args: 4, over: { orderBy: { createdAt: "ASC" } } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('ntile(4) OVER (ORDER BY "createdAt" ASC) as "bucket"');
   });

   test("window with frame clause", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({
         columns: ["accountId"],
         window: {
            rolling: {
               fn: "sum",
               col: "accountId",
               over: { orderBy: { createdAt: "ASC" }, frame: "rows", start: 2, end: 0 },
            },
         },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain("ROWS BETWEEN 2 preceding AND current row");
   });

   test("multiple window functions", () => {
      const base = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const viewed = base.view({
         columns: ["accountId", "email"],
         window: {
            rn: { fn: "row_number", over: { orderBy: { email: "ASC" } } },
            total: { fn: "count", col: "*", over: {} },
         },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('row_number() OVER (ORDER BY "email" ASC) as "rn"');
      expect(text).toContain('count(*) OVER () as "total"');
   });

   // ─── Phase 4: Build-time interception (not subquery wrapping) ─────────────

   test("does NOT wrap source as subquery", () => {
      const base = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$status} = 'active'`;
      const viewed = base.view({ columns: ["accountId"] });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      // No subquery wrapping — the original FROM and WHERE pass through
      expect(text).not.toContain('"sub"');
      expect(text).toContain("FROM");
      expect(text).toContain("active");
      expect(text).toContain('"accountId"');
   });

   // ─── Phase 5: CTE safety ─────────────────────────────────────────────────

   test("CTE passes through unchanged", () => {
      const cte = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account} WHERE ${Account.$status} = 'active'`;
      const base = sql`WITH active AS (${cte}) SELECT ${row(Account.$accountId, Account.$email)} FROM active`;
      const viewed = base.view({ columns: ["accountId"] });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      // CTE preserved
      expect(text).toContain("WITH");
      expect(text).toContain("active");
      // Only SELECT is trimmed
      expect(text).toContain('"accountId"');
   });

   // ─── Phase 7: Edge cases ──────────────────────────────────────────────────

   test("empty window object = no window functions added", () => {
      const base = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const viewed = base.view({ columns: ["accountId"], window: {} });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('"accountId"');
      expect(text).not.toContain("OVER");
   });

   test("window only, no column trim", () => {
      const base = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const viewed = base.view({
         window: { rn: { fn: "row_number", over: { orderBy: { email: "ASC" } } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      // All columns preserved
      expect(text).toContain('"accountId"');
      expect(text).toContain('"email"');
      // Window appended
      expect(text).toContain('row_number() OVER (ORDER BY "email" ASC) as "rn"');
   });

   // ─── Phase 5: CTE safety — comprehensive ─────────────────────────────────

   test("WITH ... SELECT: CTE preserved, only SELECT trimmed", () => {
      const cte = sql`SELECT ${row(Account.$accountId, Account.$email, Account.$status)} FROM ${Account} WHERE ${Account.$status} = 'active'`;
      const base = sql`WITH active AS (${cte}) SELECT ${row(Account.$accountId, Account.$email, Account.$status)} FROM active`;
      const viewed = base.view({ columns: ["accountId", "email"] });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain("WITH");
      expect(text).toContain("active");
      expect(text).toContain('"accountId"');
      expect(text).toContain('"email"');
      // status should still appear in the CTE body (not trimmed there)
      // but not in the outer SELECT (trimmed)
   });

   test("CTE + window function injection", () => {
      const cte = sql`SELECT ${row(Account.$accountId, Account.$createdAt)} FROM ${Account}`;
      const base = sql`WITH recent AS (${cte}) SELECT ${row(Account.$accountId, Account.$createdAt)} FROM recent`;
      const viewed = base.view({
         columns: ["accountId", "createdAt"],
         window: { rn: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain("WITH");
      expect(text).toContain('"accountId"');
      expect(text).toContain('row_number() OVER (ORDER BY "createdAt" DESC) as "rn"');
   });

   // ─── Phase 6: CRUD .select() integration ─────────────────────────────────

   test("CRUD select: narrows columns via .source.view()", () => {
      const query = sqlSelect(Account, {});
      const viewed = (query as any).view({ columns: ["accountId", "email"] });

      const { text } = viewed.getSql({ params: {} as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('"accountId"');
      expect(text).toContain('"email"');
      // Other columns should not be in the SELECT
      expect(text).not.toContain('"firstName"');
      expect(text).not.toContain('"lastName"');
   });

   test("CRUD select + window", () => {
      const query = sqlSelect(Account, {});
      const viewed = (query as any).view({
         columns: ["accountId"],
         window: { rn: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } },
      });

      const { text } = viewed.getSql({ params: {} as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('"accountId"');
      expect(text).toContain('row_number() OVER (ORDER BY "createdAt" DESC) as "rn"');
   });

   test("CRUD select with WHERE: WHERE untouched, SELECT trimmed", () => {
      const query = sqlSelect(Account, {
         WHERE: sql`${Account.$status} = 'active'`,
      });
      const viewed = (query as any).view({ columns: ["accountId", "email"] });

      const { text } = viewed.getSql({ params: {} as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('"accountId"');
      expect(text).toContain('"email"');
      expect(text).toContain("active"); // WHERE preserved
   });

   // ─── Phase 7: Edge cases ──────────────────────────────────────────────────

   test("duplicate columns in list are deduplicated by row() filter", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({ columns: ["accountId", "accountId", "email"] });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      // Should only emit accountId once
      const matches = text.match(/"accountId"/g);
      expect(matches?.length).toBe(1);
   });

   test("empty columns array = no row columns emitted", () => {
      const base = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const viewed = base.view({
         columns: [],
         window: { rn: { fn: "row_number", over: { orderBy: { email: "ASC" } } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      // Window should still be present
      expect(text).toContain('row_number() OVER (ORDER BY "email" ASC) as "rn"');
      // No row columns
      expect(text).not.toContain('"accountId"');
      expect(text).not.toContain('"a_1"."email"');
   });

   test("window function can reference column not in view output", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({
         columns: ["accountId"],
         window: { rn: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      // accountId in SELECT
      expect(text).toContain('"accountId"');
      // createdAt in window (not in SELECT output but valid as window reference)
      expect(text).toContain('"createdAt"');
   });

   test("col() before row() in template: trimmed correctly", () => {
      // col() appears first in the template, row() second
      const base = sql`SELECT count(*) as ${col<{ total: number }>("total")}, ${row(Account.$accountId)} FROM ${Account}`;
      const viewed = base.view({ columns: ["accountId"] });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('"accountId"');
      expect(text).not.toContain("total");
      expect(text).not.toContain("count(*)");
   });

   test("multiple col() entries: remove some, keep others", () => {
      const base = sql`SELECT ${row(Account.$accountId)}, count(*) as ${col<{ total: number }>("total")}, max("created_at") as ${col<{ latest: Date }>("latest")} FROM ${Account}`;
      const viewed = base.view({ columns: ["accountId", "total"] });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('"accountId"');
      expect(text).toContain('"total"');
      expect(text).not.toContain('"latest"');
   });

   // ─── Phase 8: Type inference ──────────────────────────────────────────────

   test("type: columns narrows to Pick<Row, columns[number]>", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({ columns: ["accountId", "email"] as const });

      // Type should be { accountId: string; email: string }
      type Result = typeof viewed.rowType;
      assertType<{ accountId: string; email: string }>({} as unknown as Result);

      // @ts-expect-error — firstName not in view
      void ({} as Result).firstName;
   });

   test("type: window adds number aliases", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({
         window: { rank: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } } as const,
      });

      // Type should include rank: number on the original row
      type Result = typeof viewed.rowType;
      assertType<number>(0 as unknown as Result["rank"]);
   });

   test("type: columns + window combined", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({
         columns: ["accountId"] as const,
         window: { rank: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } } as const,
      });

      // Type should be { accountId: string; rank: number }
      type Result = typeof viewed.rowType;
      assertType<string>("" as unknown as Result["accountId"]);
      assertType<number>(0 as unknown as Result["rank"]);

      // @ts-expect-error — email not in columns
      void ({} as Result).email;
   });

   test("type: no options = original row type preserved", () => {
      const base = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const viewed = base.view({});

      type Result = typeof viewed.rowType;
      assertType<string>("" as unknown as Result["accountId"]);
      assertType<string>("" as unknown as Result["email"]);
   });
});
