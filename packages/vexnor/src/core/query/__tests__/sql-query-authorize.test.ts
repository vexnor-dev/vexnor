import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";

describe("SqlQuery.authorize", () => {
   test("authorization is empty on an untagged query", () => {
      const query = sql`SELECT 1`;
      expect(query.authorization).toEqual([]);
   });

   test(".authorize() returns a new object, does not mutate the original", () => {
      const original = sql`SELECT 1`;
      const tagged = original.authorize("admin");
      expect(tagged.authorization).toEqual(["admin"]);
      expect(original.authorization).toEqual([]);
      expect(tagged).not.toBe(original);
   });

   test(".authorize() accumulates tags when called multiple times", () => {
      const query = sql`SELECT 1`.authorize("admin").authorize("superuser");
      expect(query.authorization).toEqual(["admin", "superuser"]);
   });

   test(".authorize() accepts multiple tags at once", () => {
      const query = sql`SELECT 1`.authorize("admin", "audit");
      expect(query.authorization).toEqual(["admin", "audit"]);
   });

   test("authorization inherits tags from subqueries", () => {
      const inner = sql`SELECT ${row(Order.$$)} FROM ${Order} WHERE ${Order.$accountId} = ${Account.out.$accountId}`.authorize("user");
      const outer = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} IN (${inner})`;
      expect(outer.authorization).toEqual(["user"]);
   });

   test("authorization merges own tags with subquery tags (deduplicated)", () => {
      const inner = sql`SELECT ${row(Order.$$)} FROM ${Order} WHERE ${Order.$accountId} = ${Account.out.$accountId}`.authorize("user");
      const outer = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} IN (${inner})`.authorize("admin");
      expect(outer.authorization).toEqual(["admin", "user"]);
   });

   test("authorization deduplicates inherited tags", () => {
      const inner = sql`SELECT ${row(Order.$$)} FROM ${Order} WHERE ${Order.$accountId} = ${Account.out.$accountId}`.authorize("admin");
      const outer = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} IN (${inner})`.authorize("admin");
      expect(outer.authorization).toEqual(["admin"]);
   });
});
