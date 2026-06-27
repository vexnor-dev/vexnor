import { describe, expect, test } from "vitest";
import { newSqlQueryRef } from "#src/core/query/sql-query-ref.js";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";

const innerQuery = sql`select ${row(Account.$accountId, Account.$email)} from ${Account}`;

describe("SqlQueryRef — proxy access patterns", () => {
   test("ref with scope allows access to row columns via proxy", () => {
      const ref = newSqlQueryRef(innerQuery, { queryType: "main" });
      expect(ref.row).toBeDefined();
      expect(ref.row!.$accountId).toBeDefined();
      // proxy `has`
      expect("row" in ref).toBe(true);
      expect("$accountId" in ref).toBe(true);
   });

   test("ref proxy get returns undefined for unknown keys", () => {
      const ref = newSqlQueryRef(innerQuery, { queryType: "main" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((ref as any).nonExistentProp).toBeUndefined();
   });

   test("ref proxy ownKeys includes row keys", () => {
      const ref = newSqlQueryRef(innerQuery, { queryType: "main" });
      const keys = Object.keys(ref);
      expect(keys).toContain("$accountId");
      expect(keys).toContain("$email");
   });

   test("ref proxy getOwnPropertyDescriptor returns descriptor for row keys", () => {
      const ref = newSqlQueryRef(innerQuery, { queryType: "main" });
      const desc = Object.getOwnPropertyDescriptor(ref, "$accountId");
      expect(desc).toBeDefined();
   });

   test("ref proxy getOwnPropertyDescriptor returns undefined for unknown keys", () => {
      const ref = newSqlQueryRef(innerQuery, { queryType: "main" });
      const desc = Object.getOwnPropertyDescriptor(ref, "nonExistent");
      expect(desc).toBeUndefined();
   });
});

describe("SqlQueryRef — recursive mode", () => {
   test("newSqlQueryRef with recursive=true creates a ref", () => {
      const ref = newSqlQueryRef(innerQuery, null, true);
      expect(ref).toBeDefined();
      expect(ref.row).toBeDefined();
   });

   test("recursive ref uses cache — same ref returned", () => {
      const ref1 = newSqlQueryRef(innerQuery, null, true);
      const ref2 = newSqlQueryRef(innerQuery, null, true);
      // Both should point to the same underlying target
      expect(ref1.id).toBe(ref2.id);
   });
});

describe("SqlQueryRef — write() with out=true", () => {
   test("out ref builds correctly inside a query", () => {
      // The `out` property on a table produces columns that reference the parent query context.
      // Testing via a full sql template ensures the write path for out=true is exercised.
      const q = sql`select ${row(Account.$accountId)} from ${Account} where ${Account.$accountId} = ${Account.out.$accountId}`;
      expect(q).toBeDefined();
      expect(q.row).toBeDefined();
   });
});

describe("SqlQueryRef — $$ delegate", () => {
   test("$$ returns innerQuery.$$", () => {
      const ref = newSqlQueryRef(innerQuery, { queryType: "main" });
      expect(ref.$$).toBe(innerQuery.$$);
   });
});

describe("SqlQueryRef — initRow with no row", () => {
   test("returns null when innerQuery has no row", () => {
      const noRowQuery = sql`SELECT 1`;
      const ref = newSqlQueryRef(noRowQuery, { queryType: "main" });
      expect(ref.row).toBeNull();
   });
});

describe("SqlQueryRef — cache by scope keys", () => {
   test("same scope produces same cached ref", () => {
      const ref1 = newSqlQueryRef(innerQuery, { queryType: "main", paramKey: "a" });
      const ref2 = newSqlQueryRef(innerQuery, { queryType: "main", paramKey: "a" });
      expect(ref1.id).toBe(ref2.id);
   });
});
