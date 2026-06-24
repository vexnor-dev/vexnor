/**
 * Generates cross-runtime test data:
 * 1. Serialized manifest (for .NET to load)
 * 2. Expected { text, values } output per test case (for .NET to assert against)
 *
 * Run: node --experimental-vm-modules stacks/fixtures/generate-cross-runtime.mjs
 */
import {
   sql,
   row,
   orderBy,
   filterBy,
   insert,
   set,
   when,
   param,
   SqlPagination,
   upsert,
   serializeManifest,
} from "@vexnor/core";
import { Account } from "./codegen/postgres/vexnor_dev.account-table.js";
import { writeFileSync, mkdirSync } from "node:fs";


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
};

// ─── Test params per case ────────────────────────────────────────────────────

const testParams: Record<string, any> = {
   xOrderBySingle: { orderBy: { createdAt: "DESC" } },
   xOrderByMulti: { orderBy: { status: "ASC", createdAt: "DESC" } },
   xOrderByNull: { orderBy: null },
   xFilterEquality: { filterBy: { email: "jane@example.com", status: "active" } },
   xFilterOperators: { filterBy: [{ createdAt: [">=", "2024-01-01"] }, { status: ["in", "active", "confirmed"] }, { parentId: ["isNull"] }] },
   xFilterOrGroup: { filterBy: [{ status: "active" }, { or: [{ email: ["like", "%@vip.com"] }, { parentId: ["isNotNull"] }] }] },
   xFilterEmpty: { filterBy: null },
   xInsertSingle: { rows: [{ email: "a@test.com", firstName: "A", lastName: "B" }] },
   xInsertMulti: { rows: [{ email: "a@test.com", firstName: "A", lastName: "AA" }, { email: "b@test.com", firstName: "B", lastName: "BB" }] },
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
   xUpsertMulti: { rows: [{ accountId: "uuid-1", email: "a@test.com", firstName: "A", lastName: "AA" }, { accountId: "uuid-2", email: "b@test.com", firstName: "B", lastName: "BB" }] },
   xUpsertMssql: { rows: [{ accountId: "uuid-1", email: "a@test.com", firstName: "A", lastName: "B" }] },
   xInsertEmpty: { rows: [] },
};

// ─── Generate outputs ────────────────────────────────────────────────────────

const results: Record<string, { hash: string; text: string | null; values: unknown[] | null; error: string | null }> = {};

for (const [name, query] of Object.entries(queries)) {
   const params = testParams[name];
   const hash = await query.hash;
   const dialect = name.includes("Mssql") ? "transactsql" : "postgresql";
   try {
      const { text, values } = query.getSql({ params, options: { dialect, format: false } });
      results[name] = { hash, text, values, error: null };
   } catch (e) {
      results[name] = { hash, text: null, values: null, error: e.message };
   }
}

// ─── Serialize manifest ──────────────────────────────────────────────────────

const queryEntries = [];
for (const [name, query] of Object.entries(queries)) {
   queryEntries.push({ query, name, hash: await query.hash });
}
const manifest = await serializeManifest(queryEntries, "postgresql");

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
      console.log(`  ✓ ${name}: ${result.values.length} params`);
   }
}
