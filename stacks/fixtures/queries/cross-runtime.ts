/**
 * Cross-Runtime Test Fixture
 *
 * This file defines queries with ALL operator variations and their expected params.
 * It is:
 * 1. Compiled by TypeScript
 * 2. Serialized to a manifest (consumed by .NET)
 * 3. Executed via .getSql() to produce expected { text, values } snapshots
 * 4. .NET tests load the manifest, run the same params, and assert identical output
 *
 * If the output differs between runtimes, the test fails.
 */
import "@vexnor/postgres";
import { filterBy, insert, orderBy, param, row, set, sql, when } from "@vexnor/core";
import { Account } from "../codegen/postgres/vexnor_dev.account-table.js";

// ─── orderBy ─────────────────────────────────────────────────────────────────

export const xOrderBySingle = sql`
   SELECT ${row(Account.$$)} FROM ${Account}
   ${orderBy(Account)}
`;

export const xOrderByMulti = sql`
   SELECT ${row(Account.$$)} FROM ${Account}
   ${orderBy(Account)}
`;

export const xOrderByNull = sql`
   SELECT ${row(Account.$$)} FROM ${Account}
   ${orderBy(Account)}
`;

// ─── filterBy ────────────────────────────────────────────────────────────────

export const xFilterEquality = sql`
   SELECT ${row(Account.$$)} FROM ${Account}
   WHERE ${filterBy(Account)}
`;

export const xFilterOperators = sql`
   SELECT ${row(Account.$$)} FROM ${Account}
   WHERE ${filterBy(Account)}
`;

export const xFilterOrGroup = sql`
   SELECT ${row(Account.$$)} FROM ${Account}
   WHERE ${filterBy(Account)}
`;

export const xFilterEmpty = sql`
   SELECT ${row(Account.$$)} FROM ${Account}
   WHERE ${filterBy(Account)}
`;

// ─── insert ──────────────────────────────────────────────────────────────────

export const xInsertSingle = sql`
   INSERT INTO ${Account}
   ${insert(Account)}
   RETURNING ${row(Account.$$)}
`;

export const xInsertMulti = sql`
   INSERT INTO ${Account}
   ${insert(Account)}
   RETURNING ${row(Account.$$)}
`;

// ─── set ─────────────────────────────────────────────────────────────────────

export const xSetSingle = sql`
   UPDATE ${Account}
   ${set(Account)}
   WHERE ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
   RETURNING ${row(Account.$$)}
`;

export const xSetMulti = sql`
   UPDATE ${Account}
   ${set(Account)}
   WHERE ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
   RETURNING ${row(Account.$$)}
`;

// ─── when (conditional inclusion) ────────────────────────────────────────────

export const xWhenTrue = sql`
   SELECT ${row(Account.$$)} FROM ${Account}
   WHERE ${Account.$status} = ${param<{ status: string }>("status")}
   ${when("hasEmail", sql`AND ${Account.$email} = ${param<{ email: string }>("email")}`)}
`;

export const xWhenFalse = sql`
   SELECT ${row(Account.$$)} FROM ${Account}
   WHERE ${Account.$status} = ${param<{ status: string }>("status")}
   ${when("hasEmail", sql`AND ${Account.$email} = ${param<{ email: string }>("email")}`)}
`;

export const xWhenWithElse = sql`
   SELECT ${row(Account.$$)} FROM ${Account}
   ORDER BY ${Account.$createdAt} ${when("sortAsc", sql`ASC`, sql`DESC`)}
`;

// ─── combined ────────────────────────────────────────────────────────────────

export const xCombined = sql`
   SELECT ${row(Account.$$)} FROM ${Account}
   WHERE ${filterBy(Account)}
   ${orderBy(Account)}
`;

// ─── Test cases: query name → params to execute with ─────────────────────────

export const crossRuntimeTestCases = {
   // orderBy
   xOrderBySingle: { params: { orderBy: { createdAt: "DESC" } } },
   xOrderByMulti: { params: { orderBy: { status: "ASC", createdAt: "DESC" } } },
   xOrderByNull: { params: { orderBy: null } },

   // filterBy
   xFilterEquality: { params: { filterBy: { email: "jane@example.com", status: "active" } } },
   xFilterOperators: {
      params: {
         filterBy: [
            { createdAt: ["greaterOrEqual", "2024-01-01"] },
            { status: ["in", ["active", "confirmed"]] },
            { parentId: ["isNull"] },
         ],
      },
   },
   xFilterOrGroup: {
      params: {
         filterBy: [{ status: "active" }, { or: [{ email: ["like", "%@vip.com"] }, { parentId: ["isNotNull"] }] }],
      },
   },
   xFilterEmpty: { params: { filterBy: null } },

   // insert
   xInsertSingle: { params: { rows: [{ email: "a@test.com", firstName: "A", lastName: "B" }] } },
   xInsertMulti: {
      params: {
         rows: [
            { email: "a@test.com", firstName: "A", lastName: "AA" },
            { email: "b@test.com", firstName: "B", lastName: "BB" },
         ],
      },
   },

   // set
   xSetSingle: { params: { set: { email: "updated@test.com" }, accountId: "uuid-123" } },
   xSetMulti: { params: { set: { email: "new@test.com", firstName: "Jane", lastName: "Doe" }, accountId: "uuid-456" } },

   // when
   xWhenTrue: { params: { status: "active", hasEmail: true, email: "test@example.com" } },
   xWhenFalse: { params: { status: "active", hasEmail: false, email: "test@example.com" } },
   xWhenWithElse: { params: { sortAsc: true } },

   // combined
   xCombined: {
      params: {
         filterBy: [{ status: "active" }, { email: ["like", "%@vip%"] }],
         orderBy: { createdAt: "DESC" },
      },
   },
};
