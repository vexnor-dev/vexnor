import { describe, expect, test } from "vitest";
import { sql, row } from "@vexnor/core";
import "#src/core/query/sql-view.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

describe(".view()", () => {
   test("narrows columns from a query", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({ columns: ["accountId", "email"] });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('"sub"."accountId"');
      expect(text).toContain('"sub"."email"');
      expect(text).not.toContain('"sub"."firstName"');
      expect(text).not.toContain('"sub"."lastName"');
   });

   test("adds window function", () => {
      const base = sql`SELECT ${row(Account.$accountId, Account.$createdAt)} FROM ${Account}`;
      const viewed = base.view({
         columns: ["accountId", "createdAt"],
         window: { rank: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('"sub"."accountId"');
      expect(text).toContain('"sub"."createdAt"');
      expect(text).toContain('row_number() OVER (ORDER BY "sub"."createdAt" DESC) as "rank"');
   });

   test("no columns = all from subquery", () => {
      const base = sql`SELECT ${row(Account.$accountId, Account.$email)} FROM ${Account}`;
      const viewed = base.view({
         window: { rn: { fn: "row_number", over: { orderBy: { email: "ASC" } } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('"sub".*');
      expect(text).toContain('row_number() OVER (ORDER BY "sub"."email" ASC) as "rn"');
   });

   test("window with partitionBy + orderBy", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({
         columns: ["accountId"],
         window: { rn: { fn: "rank", over: { partitionBy: ["status"], orderBy: { createdAt: "DESC" } } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('PARTITION BY "sub"."status"');
      expect(text).toContain('ORDER BY "sub"."createdAt" DESC');
      expect(text).toContain('rank()');
   });

   test("window with aggregate function", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({
         columns: ["accountId", "status"],
         window: { total: { fn: "count", col: "accountId", over: { partitionBy: ["status"] } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('count("sub"."accountId") OVER (PARTITION BY "sub"."status") as "total"');
   });

   test("window with offset function (lag)", () => {
      const base = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const viewed = base.view({
         columns: ["accountId", "email"],
         window: { prev: { fn: "lag", col: "email", args: 1, over: { orderBy: { createdAt: "ASC" } } } },
      });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      expect(text).toContain('lag("sub"."email", 1) OVER (ORDER BY "sub"."createdAt" ASC) as "prev"');
   });

   test("wraps source as subquery in FROM", () => {
      const base = sql`SELECT ${row(Account.$accountId)} FROM ${Account} WHERE ${Account.$status} = 'active'`;
      const viewed = base.view({ columns: ["accountId"] });

      const { text } = viewed.getSql({ params: undefined as any, options: { dialect: "postgresql", format: false } });
      // Should contain the original query wrapped as subquery
      expect(text).toContain("FROM");
      expect(text).toContain('"sub"');
      expect(text).toContain("active");
   });
});
