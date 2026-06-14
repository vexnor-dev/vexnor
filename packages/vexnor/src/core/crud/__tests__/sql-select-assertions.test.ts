import { describe, expect, test } from "vitest";
import { sqlSelect, expandFromClause } from "#/core/crud/sql-select.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { sql } from "#/core/sql.js";
import { param } from "#/core/query/sql-param.js";

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

   test("throws when offset is provided", () => {
      expect(() =>
         sqlSelect(Account, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            offset: param<{ offset: number }>("offset") as any,
         }),
      ).toThrow("offset");
   });

   test("throws when limit is provided", () => {
      expect(() =>
         sqlSelect(Account, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            limit: param<{ limit: number }>("limit") as any,
         }),
      ).toThrow("limit");
   });
});

describe("expandFromClause", () => {
   test("generates FROM clause with all optional parts", () => {
      const fragment = expandFromClause(Account, {
         JOIN: sql`JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}`,
         WHERE: sql`${Account.$email} = 'test'`,
         GROUP_BY: sql`${Account.$accountId}`,
         HAVING: sql`count(*) > 1`,
         ORDER_BY: sql`${Account.$createdAt} DESC`,
      });
      const { text } = fragment.getSql({ params: {}, options: { dialect: "sqlite" } });
      expect(text).toContain("FROM");
      expect(text).toContain("JOIN");
      expect(text).toContain("WHERE");
      expect(text).toContain("GROUP BY");
      expect(text).toContain("HAVING");
      expect(text).toContain("ORDER BY");
   });

   test("generates FROM clause with no optional parts", () => {
      const fragment = expandFromClause(Account, {});
      const { text } = fragment.getSql({ params: {}, options: { dialect: "sqlite" } });
      expect(text).toContain("account");
   });
});
