/**
 * Filter Operator Test Fixture
 *
 * This file defines test cases for EVERY filter operator supported by the SqlFilter system.
 * It is compiled by TypeScript and serialized to a manifest that the .NET tests consume.
 *
 * COMPILE-TIME ENFORCEMENT:
 * The `FilterOperatorTestCases` type requires a test case for each operator in `FilterOp`.
 * If a new operator is added to the type system and not added here, TypeScript will error.
 */
import "@vexnor/postgres";
import { filterBy, row, sql } from "@vexnor/core";
import { Account } from "../codegen/postgres/vexnor_dev.account-table.js";

// ─── Operator type (mirrors the runtime FilterOp union in sql-filter.ts) ─────

type FilterOp =
   | "equal"
   | "not"
   | "greaterThan"
   | "greaterOrEqual"
   | "lowerThan"
   | "lowerOrEqual"
   | "between"
   | "in"
   | "notIn"
   | "like"
   | "notLike"
   | "isNull"
   | "isNotNull";

// ─── Compile-time enforcement: every operator must have a test case ──────────

type FilterOperatorTestCases = {
   [K in FilterOp]: { params: Record<string, unknown> };
};

/**
 * If this object is missing a key, TypeScript will emit a compile error.
 * This guarantees every operator in FilterOp has a corresponding test fixture.
 */
const operatorTestCases: FilterOperatorTestCases = {
   equal: { params: { filter: [{ email: ["equal", "test@example.com"] }] } },
   not: { params: { filter: [{ status: ["not", "deleted"] }] } },
   greaterThan: { params: { filter: [{ createdAt: ["greaterThan", "2024-01-01"] }] } },
   greaterOrEqual: { params: { filter: [{ createdAt: ["greaterOrEqual", "2024-01-01"] }] } },
   lowerThan: { params: { filter: [{ createdAt: ["lowerThan", "2025-01-01"] }] } },
   lowerOrEqual: { params: { filter: [{ createdAt: ["lowerOrEqual", "2025-01-01"] }] } },
   between: { params: { filter: [{ createdAt: ["between", "2024-01-01", "2025-01-01"] }] } },
   in: { params: { filter: [{ status: ["in", ["created", "confirmed"]] }] } },
   notIn: { params: { filter: [{ status: ["notIn", ["deleted"]] }] } },
   like: { params: { filter: [{ email: ["like", "%@vip.com"] }] } },
   notLike: { params: { filter: [{ email: ["notLike", "%spam%"] }] } },
   isNull: { params: { filter: [{ parentId: ["isNull"] }] } },
   isNotNull: { params: { filter: [{ parentId: ["isNotNull"] }] } },
};

// ─── Additional compound test cases ─────────────────────────────────────────

const compoundTestCases = {
   multipleConditionsAnd: {
      params: { filter: [{ status: "active" }, { email: ["like", "%@vip.com"] }] },
   },
   orGroup: {
      params: {
         filter: [{ status: "active" }, { or: [{ email: ["like", "%@vip.com"] }, { parentId: ["isNotNull"] }] }],
      },
   },
   legacyObjectForm: {
      params: { filter: { email: "jane@example.com", status: "confirmed" } },
   },
   emptyFilter: {
      params: { filter: [] },
   },
   nullFilter: {
      params: { filter: null },
   },
   inEmptyArray: {
      params: { filter: [{ status: ["in", []] }] },
   },
   notInEmptyArray: {
      params: { filter: [{ status: ["notIn", []] }] },
   },
};

// ─── Export the query that the .NET tests will execute against ────────────────

export const filterOperatorQuery = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   WHERE ${filterBy(Account, "filter")}
`;

// Export test cases so the serialize output and .NET test can reference them
export const testCases = { ...operatorTestCases, ...compoundTestCases };

// Force TypeScript to verify the type (unused at runtime, but compile-checked)
void operatorTestCases;
