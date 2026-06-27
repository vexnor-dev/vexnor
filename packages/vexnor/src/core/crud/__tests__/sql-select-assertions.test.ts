import { describe, expect, test } from "vitest";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { sql } from "#src/core/sql.js";
import { sqlSelect } from "#src/core/crud/sql-select.js";

describe("sqlSelect — assertion branches", () => {
   test("throws when includeMany has entries", () => {
      expect(() =>
         sqlSelect(Account, {
            includeMany: { orders: sql`select 1` },
         }),
      ).toThrow("includeMany");
   });

   test("throws when includeOne has entries", () => {
      expect(() =>
         sqlSelect(Account, {
            includeOne: { lastOrder: sql`select 1` },
         }),
      ).toThrow("includeOne");
   });
});
