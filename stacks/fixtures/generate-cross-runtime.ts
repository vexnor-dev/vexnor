/**
 * Generates cross-runtime test data:
 * 1. Serialized manifest (for .NET to load)
 * 2. Expected { text, values } output per test case (for .NET to assert against)
 *
 * Run: node --experimental-vm-modules stacks/fixtures/generate-cross-runtime.mjs
 */
import {
   filterBy,
   insert,
   orderBy,
   param,
   row,
   serializeManifest,
   set,
   sql,
   SqlJoinBy,
   SqlPagination,
   upsert,
   when,
   windowBy,
} from "@vexnor/core";
import { Account } from "./codegen/postgres/vexnor_dev.account-table.js";
import { Order } from "./codegen/postgres/vexnor_dev.order-table.js";
import { OrderItem } from "./codegen/postgres/vexnor_dev.order_item-table.js";
import { AccountStatusUdt } from "./codegen/postgres/vexnor_dev-enums.js";
import { mkdirSync, writeFileSync } from "node:fs";

// ─── Define queries ──────────────────────────────────────────────────────────

const queries = {
   xOrderBySingle: sql`SELECT ${row(Account.$$)} FROM ${Account} ${orderBy(Account)}`,
   xOrderByMulti: sql`SELECT ${row(Account.$$)} FROM ${Account} ${orderBy(Account)}`,
   xOrderByNull: sql`SELECT ${row(Account.$$)} FROM ${Account} ${orderBy(Account)}`,
   xFilterEquality: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`,
   xFilterOperators: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`,
   xFilterOrGroup: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`,
   xFilterEmpty: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`,
   xInsertSingle: sql`INSERT INTO ${Account} ${insert(Account)} RETURNING ${row(Account.$$)}`,
   xInsertMulti: sql`INSERT INTO ${Account} ${insert(Account)} RETURNING ${row(Account.$$)}`,
   xSetSingle: sql`UPDATE ${Account} ${set(Account)} WHERE ${Account.$accountId} = ${param("accountId")} RETURNING ${row(Account.$$)}`,
   xSetMulti: sql`UPDATE ${Account} ${set(Account)} WHERE ${Account.$accountId} = ${param("accountId")} RETURNING ${row(Account.$$)}`,
   xWhenTrue: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$status} = ${param("status")} ${when("hasEmail", sql`AND ${Account.$email} = ${param("email")}`)}`,
   xWhenFalse: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$status} = ${param("status")} ${when("hasEmail", sql`AND ${Account.$email} = ${param("email")}`)}`,
   xWhenWithElse: sql`SELECT ${row(Account.$$)} FROM ${Account} ORDER BY ${Account.$createdAt} ${when("sortAsc", sql`ASC`, sql`DESC`)}`,
   xWhenNegate: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$status} = ${param("status")} ${when("!hideEmail", sql`AND ${Account.$email} IS NOT NULL`)}`,
   xPaginationBoth: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)} ${orderBy(Account)} ${new SqlPagination()}`,
   xPaginationLimitOnly: sql`SELECT ${row(Account.$$)} FROM ${Account} ${new SqlPagination()}`,
   xCombined: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)} ${orderBy(Account)}`,
   xUpsertSingle: sql`INSERT INTO ${Account} ${upsert(Account, ["accountId"])} RETURNING ${row(Account.$$)}`,
   xUpsertMulti: sql`INSERT INTO ${Account} ${upsert(Account, ["accountId"])} RETURNING ${row(Account.$$)}`,
   xUpsertMssql: sql`MERGE INTO ${Account} ${upsert(Account, ["accountId"])} OUTPUT inserted.*;`,
   xInsertEmpty: sql`INSERT INTO ${Account} ${insert(Account)} RETURNING ${row(Account.$$)}`,
   xJoinBySingle: sql`SELECT ${row(Order.$$)} FROM ${Order} ${new SqlJoinBy(Order, "joinBy", {}, { account: Account })}`,
   xJoinByWithType: sql`SELECT ${row(Order.$$)} FROM ${Order} ${new SqlJoinBy(Order, "joinBy", { account: "left" }, { account: Account })}`,
   xJoinByMultiCondition: sql`SELECT ${row(Order.$$)} FROM ${Order} ${new SqlJoinBy(Order, "joinBy", {}, { account: Account })}`,
   // Auto-join hash uniqueness: different join maps from same root MUST produce different hashes
   xJoinByAutoSingle: Order.join({ account: Account }).select({}),
   xJoinByAutoMulti: Order.join({ account: Account, orderItem: OrderItem }).select({}),
   // insert.cols() + insert.values() split pattern
   xInsertColsSingle: sql`INSERT INTO ${Account} (${insert.cols(Account)}) VALUES (${insert.values(Account)}) RETURNING ${row(Account.$$)}`,
   xInsertColsMulti: sql`INSERT INTO ${Account} (${insert.cols(Account)}) VALUES (${insert.values(Account)}) RETURNING ${row(Account.$$)}`,
   // Inline literal value (UDT enum — produces "value" node in serialized manifest)
   xValueLiteral: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$status} = ${AccountStatusUdt.CONFIRMED}`,

   // ─── Filter operator coverage (writeOp paths) ─────────────────────────────
   xFilterNot: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`,
   xFilterNotEqual: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`,
   xFilterGt: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`,
   xFilterLt: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`,
   xFilterLte: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`,
   xFilterBetween: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`,
   xFilterNotIn: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`,
   xFilterLike: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`,
   xFilterNotLike: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`,

   // ─── Nested OR/AND coverage ───────────────────────────────────────────────
   xFilterNestedOrAnd: sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${filterBy(Account)}`,

   // ─── Projection coverage (buildProjection paths) ──────────────────────────
   // Projection fixtures are injected manually below (array-format params for Go/C#)

   // ─── JoinBy cross join type ───────────────────────────────────────────────
   xJoinByCross: sql`SELECT ${row(Order.$$)} FROM ${Order} ${new SqlJoinBy(Order, "joinBy", { account: "cross" }, { account: Account })}`,

   // ─── Pagination offset-only ───────────────────────────────────────────────
   xPaginationOffsetOnly: sql`SELECT ${row(Account.$$)} FROM ${Account} ${new SqlPagination()}`,
   // windowBy — runtime window functions
   xWindowByRanking: sql`SELECT ${row(Account.$accountId, Account.$createdAt)} ${windowBy(Account)} FROM ${Account}`,
   xWindowByAggregate: sql`SELECT ${row(Account.$accountId, Account.$createdAt)} ${windowBy(Account)} FROM ${Account}`,
   xWindowByMultiple: sql`SELECT ${row(Account.$accountId, Account.$createdAt)} ${windowBy(Account)} FROM ${Account}`,
   xWindowByEmpty: sql`SELECT ${row(Account.$accountId, Account.$createdAt)} ${windowBy(Account)} FROM ${Account}`,
   // windowBy — all function categories
   xWindowByDenseRank: sql`SELECT ${row(Account.$accountId, Account.$createdAt)} ${windowBy(Account)} FROM ${Account}`,
   xWindowByPercentRank: sql`SELECT ${row(Account.$accountId, Account.$createdAt)} ${windowBy(Account)} FROM ${Account}`,
   xWindowByCumeDist: sql`SELECT ${row(Account.$accountId, Account.$createdAt)} ${windowBy(Account)} FROM ${Account}`,
   xWindowByNtile: sql`SELECT ${row(Account.$accountId, Account.$createdAt)} ${windowBy(Account)} FROM ${Account}`,
   xWindowByLead: sql`SELECT ${row(Account.$accountId, Account.$createdAt)} ${windowBy(Account)} FROM ${Account}`,
   xWindowByFirstValue: sql`SELECT ${row(Account.$accountId, Account.$createdAt)} ${windowBy(Account)} FROM ${Account}`,
   xWindowByLastValue: sql`SELECT ${row(Account.$accountId, Account.$createdAt)} ${windowBy(Account)} FROM ${Account}`,
   // windowBy — frame clause
   xWindowByFrameRows: sql`SELECT ${row(Account.$accountId, Account.$createdAt)} ${windowBy(Account)} FROM ${Account}`,
   xWindowByFrameRange: sql`SELECT ${row(Account.$accountId, Account.$createdAt)} ${windowBy(Account)} FROM ${Account}`,
   // windowBy — partition + order combined
   xWindowByPartitionOrder: sql`SELECT ${row(Account.$accountId, Account.$status, Account.$createdAt)} ${windowBy(Account)} FROM ${Account}`,
   // windowBy + all original columns ($$)
   xWindowByWithAllCols: sql`SELECT ${row(Account.$$)} ${windowBy(Account)} FROM ${Account}`,
   // windowBy + projection (select operator replaces columns, windowBy adds window fns)
   xWindowByWithProjection: sql`SELECT ${row(Account.$accountId, Account.$status)} ${windowBy(Account)} FROM ${Account}`,
};

// ─── Test params per case ────────────────────────────────────────────────────

const testParams: Record<string, unknown> = {
   xOrderBySingle: { orderBy: { createdAt: "DESC" } },
   xOrderByMulti: { orderBy: { status: "ASC", createdAt: "DESC" } },
   xOrderByNull: { orderBy: null },
   xFilterEquality: { filterBy: { email: "jane@example.com", status: "active" } },
   xFilterOperators: {
      filterBy: [
         { createdAt: [">=", "2024-01-01"] },
         { status: ["in", "active", "confirmed"] },
         { parentId: ["isNull"] },
      ],
   },
   xFilterOrGroup: {
      filterBy: [{ status: "active" }, { or: [{ email: ["like", "%@vip.com"] }, { parentId: ["isNotNull"] }] }],
   },
   xFilterEmpty: { filterBy: null },
   xInsertSingle: { rows: [{ email: "a@test.com", firstName: "A", lastName: "B" }] },
   xInsertMulti: {
      rows: [
         { email: "a@test.com", firstName: "A", lastName: "AA" },
         { email: "b@test.com", firstName: "B", lastName: "BB" },
      ],
   },
   xSetSingle: { set: { email: "updated@test.com" }, accountId: "uuid-123" },
   xSetMulti: { set: { email: "new@test.com", firstName: "Jane", lastName: "Doe" }, accountId: "uuid-456" },
   xWhenTrue: { status: "active", hasEmail: true, email: "test@example.com" },
   xWhenFalse: { status: "active", hasEmail: false, email: "test@example.com" },
   xWhenWithElse: { sortAsc: true },
   xWhenNegate: { status: "active", hideEmail: false },
   xPaginationBoth: { filterBy: { status: "active" }, orderBy: { createdAt: "DESC" }, limit: 25, offset: 50 },
   xPaginationLimitOnly: { filterBy: null, orderBy: null, limit: 10 },
   xCombined: { filterBy: [{ status: "active" }, { email: ["like", "%@vip%"] }], orderBy: { createdAt: "DESC" } },
   xUpsertSingle: { rows: [{ accountId: "uuid-1", email: "a@test.com", firstName: "A", lastName: "B" }] },
   xUpsertMulti: {
      rows: [
         { accountId: "uuid-1", email: "a@test.com", firstName: "A", lastName: "AA" },
         { accountId: "uuid-2", email: "b@test.com", firstName: "B", lastName: "BB" },
      ],
   },
   xUpsertMssql: { rows: [{ accountId: "uuid-1", email: "a@test.com", firstName: "A", lastName: "B" }] },
   xInsertEmpty: { rows: [] },
   xJoinBySingle: { joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]], type: "inner" } } },
   xJoinByWithType: { joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } } },
   xJoinByMultiCondition: {
      joinBy: {
         account: {
            on: [
               ["_.accountId", "=", "account.accountId"],
               ["_.status", "=", "account.status"],
            ],
            type: "inner",
         },
      },
   },
   xJoinByAutoSingle: { joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } }, limit: 10 },
   xJoinByAutoMulti: {
      joinBy: {
         account: { on: [["_.accountId", "=", "account.accountId"]] },
         orderItem: { on: [["_.orderId", "=", "orderItem.orderId"]] },
      },
      limit: 10,
   },
   xInsertColsSingle: { rows: [{ email: "cols@test.com", firstName: "Cols", lastName: "Test" }] },
   xInsertColsMulti: {
      rows: [
         { email: "a@test.com", firstName: "A", lastName: "AA" },
         { email: "b@test.com", firstName: "B", lastName: "BB" },
      ],
   },
   xValueLiteral: {},

   // ─── Filter operator coverage ─────────────────────────────────────────────
   xFilterNot: { filterBy: [{ status: ["not", "banned"] }] },
   xFilterNotEqual: { filterBy: [{ status: ["!=", "banned"] }] },
   xFilterGt: { filterBy: [{ createdAt: [">", "2024-06-01"] }] },
   xFilterLt: { filterBy: [{ createdAt: ["<", "2024-12-31"] }] },
   xFilterLte: { filterBy: [{ createdAt: ["<=", "2024-12-31"] }] },
   xFilterBetween: { filterBy: [{ createdAt: ["between", "2024-01-01", "2024-12-31"] }] },
   xFilterNotIn: { filterBy: [{ status: ["notIn", "banned", "deleted"] }] },
   xFilterLike: { filterBy: [{ email: ["like", "%@example.com"] }] },
   xFilterNotLike: { filterBy: [{ email: ["notLike", "%@spam.com"] }] },

   // ─── Nested OR/AND ────────────────────────────────────────────────────────
   xFilterNestedOrAnd: {
      filterBy: [
         { status: "active" },
         { or: [{ email: ["like", "%@vip.com"] }, { firstName: ["!=", "Bot"] }, { parentId: ["isNotNull"] }] },
         { email: ["notLike", "%@spam.com"] },
      ],
   },

   // ─── JoinBy cross ─────────────────────────────────────────────────────────
   xJoinByCross: { joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]], type: "cross" } } },

   // ─── Pagination offset-only ───────────────────────────────────────────────
   xPaginationOffsetOnly: { filterBy: null, orderBy: null, offset: 100 },
   xWindowByRanking: { windowBy: { rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } } } },
   xWindowByAggregate: {
      windowBy: {
         runningTotal: {
            fn: "sum",
            col: "createdAt",
            over: { partitionBy: ["accountId"], orderBy: { createdAt: "ASC" } },
         },
      },
   },
   xWindowByMultiple: {
      windowBy: {
         rn: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } },
         prev: { fn: "lag", col: "createdAt", args: 1, over: { orderBy: { createdAt: "ASC" } } },
      },
   },
   xWindowByEmpty: { windowBy: null },
   // windowBy — all function categories
   xWindowByDenseRank: { windowBy: { dr: { fn: "dense_rank", over: { orderBy: { createdAt: "DESC" } } } } },
   xWindowByPercentRank: { windowBy: { pr: { fn: "percent_rank", over: { orderBy: { createdAt: "ASC" } } } } },
   xWindowByCumeDist: { windowBy: { cd: { fn: "cume_dist", over: { orderBy: { createdAt: "ASC" } } } } },
   xWindowByNtile: { windowBy: { bucket: { fn: "ntile", args: 4, over: { orderBy: { createdAt: "ASC" } } } } },
   xWindowByLead: {
      windowBy: { nextEmail: { fn: "lead", col: "email", args: 2, over: { orderBy: { createdAt: "ASC" } } } },
   },
   xWindowByFirstValue: {
      windowBy: { first: { fn: "first_value", col: "email", over: { orderBy: { createdAt: "ASC" } } } },
   },
   xWindowByLastValue: {
      windowBy: { last: { fn: "last_value", col: "email", over: { orderBy: { createdAt: "ASC" } } } },
   },
   // windowBy — frame clauses
   xWindowByFrameRows: {
      windowBy: {
         movingSum: {
            fn: "sum",
            col: "createdAt",
            over: { orderBy: { createdAt: "ASC" }, frame: "rows", start: 2, end: 0 },
         },
      },
   },
   xWindowByFrameRange: {
      windowBy: {
         rangeSum: {
            fn: "sum",
            col: "createdAt",
            over: { orderBy: { createdAt: "ASC" }, frame: "range", start: "unbounded preceding", end: "current row" },
         },
      },
   },
   // windowBy — partition + order combined
   xWindowByPartitionOrder: {
      windowBy: { rn: { fn: "row_number", over: { partitionBy: ["status"], orderBy: { createdAt: "DESC" } } } },
   },
   // windowBy + all original columns
   xWindowByWithAllCols: { windowBy: { rank: { fn: "rank", over: { orderBy: { createdAt: "DESC" } } } } },
   // windowBy + specific columns (no projection operator, just fewer row() cols)
   xWindowByWithProjection: { windowBy: { rn: { fn: "row_number", over: { orderBy: { status: "ASC" } } } } },
};

// ─── Generate outputs ────────────────────────────────────────────────────────

const results: Record<
   string,
   { hash: string; text: string | null; values: unknown[] | null; params: unknown; error: string | null }
> = {};

for (const [name, query] of Object.entries(queries)) {
   const dialect = name.includes("Mssql") ? "transactsql" : "postgresql";
   const params = testParams[name] ?? {};
   try {
      const { text, values } = query.getSql({ params: params as never, options: { dialect, format: false } });
      results[name] = { hash: name, text, values, params, error: null };
   } catch (e) {
      results[name] = { hash: name, text: null, values: null, params, error: String(e) };
   }
}

// ─── Serialize manifest ──────────────────────────────────────────────────────

// Build manifest using test names as keys to avoid hash collisions
// (queries with same template but different joinTypes share a hash)
const manifest = await serializeManifest(
   Object.entries(queries).map(([name, query]) => ({ query, name, hash: name })),
   "postgresql",
);

// Re-serialize entries that need a different dialect (e.g., MSSQL)
for (const [name, query] of Object.entries(queries)) {
   if (name.includes("Mssql")) {
      const mssqlManifest = await serializeManifest([{ query, name, hash: name }], "transactsql");
      manifest.queries[name] = mssqlManifest.queries[name]!;
   }
}

// ─── Manually inject array param fixture ─────────────────────────────────────
// This tests buildParam with node.Array=true (param expanded to $1, $2, $3...)
// The TypeScript serializer doesn't produce this from any built-in operator,
// but Go/C# support it — so we inject it directly into the manifest.
manifest.queries["xParamArray"] = {
   name: "xParamArray",
   hash: "xParamArray",
   location: "generate-cross-runtime.ts",
   template: [
      { type: "text", value: 'SELECT * FROM "main"."account" WHERE "account"."account_id" IN (' },
      { type: "param", name: "ids", array: true },
      { type: "text", value: ")" },
   ] as any,
   params: { ids: { name: "ids" } },
   authorization: [],
   row: null,
};
results["xParamArray"] = {
   hash: "xParamArray",
   text: 'SELECT * FROM "main"."account" WHERE "account"."account_id" IN ($1, $2, $3)',
   values: ["id-1", "id-2", "id-3"],
   params: { ids: ["id-1", "id-2", "id-3"] },
   error: null,
};

// Inject MSSQL variant of array param
manifest.queries["xParamArrayMssql"] = {
   name: "xParamArrayMssql",
   hash: "xParamArrayMssql",
   location: "generate-cross-runtime.ts",
   template: [
      { type: "text", value: 'SELECT * FROM "main"."account" WHERE "account"."account_id" IN (' },
      { type: "param", name: "ids", array: true },
      { type: "text", value: ")" },
   ] as any,
   params: { ids: { name: "ids" } },
   authorization: [],
   row: null,
};
results["xParamArrayMssql"] = {
   hash: "xParamArrayMssql",
   text: 'SELECT * FROM "main"."account" WHERE "account"."account_id" IN (@param_0, @param_1, @param_2)',
   values: ["id-1", "id-2", "id-3"],
   params: { ids: ["id-1", "id-2", "id-3"] },
   error: null,
};

// ─── Projection fixtures (array-format for Go/C# buildProjection) ────────────
// These test the projection node paths that aren't reachable via TypeScript's object-format select.
const projColumns: Record<string, string> = {
   accountId: '"a_1"."account_id"',
   status: '"a_1"."status"',
   email: '"a_1"."email"',
   firstName: '"a_1"."first_name"',
   lastName: '"a_1"."last_name"',
};

// Simple column projection (no aggregates)
manifest.queries["xProjectionSimple"] = {
   name: "xProjectionSimple",
   hash: "xProjectionSimple",
   location: "generate-cross-runtime.ts",
   template: [
      { type: "text", value: "SELECT " },
      { type: "projection", param: "select", columns: projColumns },
      { type: "text", value: ' FROM "main"."account" AS "a_1"' },
   ] as any,
   params: { select: { name: "select" } },
   authorization: [],
   row: null,
};
results["xProjectionSimple"] = {
   hash: "xProjectionSimple",
   text: 'SELECT "a_1"."status", "a_1"."email" FROM "main"."account" AS "a_1"',
   values: [],
   params: { select: ["status", "email"] },
   error: null,
};

// Aggregate projection (count)
manifest.queries["xProjectionCount"] = {
   name: "xProjectionCount",
   hash: "xProjectionCount",
   location: "generate-cross-runtime.ts",
   template: [
      { type: "text", value: "SELECT " },
      { type: "projection", param: "select", columns: projColumns },
      { type: "text", value: ' FROM "main"."account" AS "a_1"' },
   ] as any,
   params: { select: { name: "select" } },
   authorization: [],
   row: null,
};
results["xProjectionCount"] = {
   hash: "xProjectionCount",
   text: 'SELECT count(*) as "total" FROM "main"."account" AS "a_1"',
   values: [],
   params: { select: [["count", "*", "total"]] },
   error: null,
};

// Mixed: columns + aggregates (triggers auto GROUP BY)
manifest.queries["xProjectionGroupBy"] = {
   name: "xProjectionGroupBy",
   hash: "xProjectionGroupBy",
   location: "generate-cross-runtime.ts",
   template: [
      { type: "text", value: "SELECT " },
      { type: "projection", param: "select", columns: projColumns },
      { type: "text", value: ' FROM "main"."account" AS "a_1"' },
   ],
   params: { select: { name: "select" } },
   authorization: [],
   row: null,
};
results["xProjectionGroupBy"] = {
   hash: "xProjectionGroupBy",
   text: 'SELECT "a_1"."status", count(*) as "statusCount", sum("a_1"."account_id") as "totalAccounts" group by "a_1"."status" FROM "main"."account" AS "a_1"',
   values: [],
   params: { select: ["status", ["count", "*", "statusCount"], ["sum", "accountId", "totalAccounts"]] },
   error: null,
};

// All aggregate functions coverage (avg, min, max)
manifest.queries["xProjectionAllAggregates"] = {
   name: "xProjectionAllAggregates",
   hash: "xProjectionAllAggregates",
   location: "generate-cross-runtime.ts",
   template: [
      { type: "text", value: "SELECT " },
      { type: "projection", param: "select", columns: projColumns },
      { type: "text", value: ' FROM "main"."account" AS "a_1"' },
   ] as any,
   params: { select: { name: "select" } },
   authorization: [],
   row: null,
};
results["xProjectionAllAggregates"] = {
   hash: "xProjectionAllAggregates",
   text: 'SELECT avg("a_1"."account_id") as "avgId", min("a_1"."account_id") as "minId", max("a_1"."account_id") as "maxId" FROM "main"."account" AS "a_1"',
   values: [],
   params: {
      select: [
         ["avg", "accountId", "avgId"],
         ["min", "accountId", "minId"],
         ["max", "accountId", "maxId"],
      ],
   },
   error: null,
};

// Projection with no select param (fallback to all columns)
manifest.queries["xProjectionFallback"] = {
   name: "xProjectionFallback",
   hash: "xProjectionFallback",
   location: "generate-cross-runtime.ts",
   template: [
      { type: "text", value: "SELECT " },
      { type: "projection", param: "select", columns: projColumns },
      { type: "text", value: ' FROM "main"."account" AS "a_1"' },
   ] as any,
   params: { select: { name: "select" } },
   authorization: [],
   row: null,
};
results["xProjectionFallback"] = {
   hash: "xProjectionFallback",
   text: 'SELECT "a_1"."account_id", "a_1"."status", "a_1"."email", "a_1"."first_name", "a_1"."last_name" FROM "main"."account" AS "a_1"',
   values: [],
   params: {},
   error: null,
};

// ─── Write outputs ───────────────────────────────────────────────────────────

const outDir = "manifests/cross-runtime";
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));
writeFileSync(`${outDir}/expected.json`, JSON.stringify(results, null, 2));

console.log(`Generated ${Object.keys(results).length} test cases`);
console.log(`Manifest: ${outDir}/manifest.json`);
console.log(`Expected: ${outDir}/expected.json`);

// Print summary
for (const [name, result] of Object.entries(results)) {
   if (result.error) {
      console.log(`  ✗ ${name}: ${result.error}`);
   } else {
      console.log(`  ✓ ${name}: ${result.values?.length} params`);
   }
}
