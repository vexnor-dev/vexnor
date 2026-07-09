import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { randomUUID } from "node:crypto";
import { insert, param, row } from "@vexnor/core";
import { sql, sqlite3Select } from "@vexnor/sqlite3";
import "@vexnor/sqlite3";
import { Account, IAccountInsert, IAccountSelect } from "./codegen/main.account-table.js";
import { Order, IOrderInsert, IOrderSelect } from "./codegen/main.order-table.js";
import { db } from "./config.js";

describe.sequential("windowBy — e2e sqlite3", () => {
   let accounts: IAccountSelect[] = [];
   let orders: IOrderSelect[] = [];

   beforeAll(async () => {
      const tag = `wfn-${randomUUID().slice(0, 8)}`;
      // Insert 3 accounts with deterministic emails for ordering
      for (let i = 0; i < 3; i++) {
         const ins: IAccountInsert = {
            accountId: randomUUID(),
            email: `${tag}-acc${i}@example.com`,
            firstName: `First${i}`,
            lastName: `Last${i}`,
         };
         const acc = await sql`insert into ${Account} ${insert(Account, "rows")} returning ${row(Account.$$)}`.sqlite.one({ db, params: { rows: [ins] } });
         accounts.push(acc);
      }
      // Insert 2 orders per account
      for (const acc of accounts) {
         for (let j = 0; j < 2; j++) {
            const oi: IOrderInsert = { accountId: acc.accountId };
            const ord = await sql`insert into ${Order} ${insert(Order, "rows")} returning ${row(Order.$$)}`.sqlite.one({ db, params: { rows: [oi] } });
            orders.push(ord);
         }
      }
   });

   describe("basic window functions", () => {
      test("row_number with orderBy", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               rowNum: { fn: "row_number", over: { orderBy: { email: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.rowNum).toBeDefined();
         // row_number produces sequential integers
         const rowNums = results.map((r) => r.rowNum);
         expect(rowNums).toMatchInlineSnapshot(`
           [
             1,
             2,
             3,
           ]
         `);
      });

      test("rank with partitionBy + orderBy", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               rnk: { fn: "rank", over: { partitionBy: ["status"], orderBy: { email: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.rnk).toBeDefined();
         // All accounts have same status='created', so rank within that partition is sequential
         const ranks = results.map((r) => r.rnk);
         for (const r of ranks) {
            expect(typeof r).toBe("number");
         }
      });

      test("dense_rank with orderBy", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               denseRnk: { fn: "dense_rank", over: { orderBy: { email: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.denseRnk).toBeDefined();
         const denseRanks = results.map((r) => r.denseRnk);
         expect(denseRanks).toMatchInlineSnapshot(`
           [
             1,
             2,
             3,
           ]
         `);
      });

      test("count(*) OVER — running count", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               runningCount: { fn: "count", col: "*", over: { orderBy: { email: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.runningCount).toBeDefined();
         const counts = results.map((r) => r.runningCount as number);
         // Running count should be monotonically non-decreasing
         for (let i = 1; i < counts.length; i++) {
            expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!);
         }
         expect(counts).toMatchInlineSnapshot(`
           [
             1,
             2,
             3,
           ]
         `);
      });

      test("count(col) OVER with partitionBy", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               statusCount: { fn: "count", col: "email", over: { partitionBy: ["status"] } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.statusCount).toBeDefined();
         // All 3 accounts have same status, so count within the partition = 3
         const statusCounts = results.map((r) => r.statusCount);
         for (const c of statusCounts) {
            expect(c).toBe(3);
         }
      });

      test("lag with offset", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               prevEmail: { fn: "lag", col: "email", args: 1, over: { orderBy: { email: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.prevEmail).toBeDefined();
         const prevEmails = results.map((r) => r.prevEmail);
         // First row has no lag → null
         expect(prevEmails[0]).toBeNull();
         // Second row's lag = first row's email
         expect(prevEmails[1]).toBe(results[0]!.email);
      });

      test("lead with offset", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               nextEmail: { fn: "lead", col: "email", args: 1, over: { orderBy: { email: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.nextEmail).toBeDefined();
         const nextEmails = results.map((r) => r.nextEmail);
         // Last row has no lead → null
         expect(nextEmails[2]).toBeNull();
         // First row's lead = second row's email
         expect(nextEmails[0]).toBe(results[1]!.email);
      });

      test("ntile with args", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               quartile: { fn: "ntile", args: 2, over: { orderBy: { email: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.quartile).toBeDefined();
         const tiles = results.map((r) => r.quartile as number);
         // ntile(2) with 3 rows: [1, 1, 2] or similar distribution
         for (const t of tiles) {
            expect(t).toBeGreaterThanOrEqual(1);
            expect(t).toBeLessThanOrEqual(2);
         }
      });

      test("first_value with orderBy", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               firstEmail: { fn: "first_value", col: "email", over: { orderBy: { email: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.firstEmail).toBeDefined();
         const firstEmails = results.map((r) => r.firstEmail);
         // first_value should be the smallest email across all rows
         const sortedEmails = [...accounts].sort((a, b) => a.email.localeCompare(b.email));
         for (const fe of firstEmails) {
            expect(fe).toBe(sortedEmails[0]!.email);
         }
      });

      test("last_value with frame ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               lastEmail: {
                  fn: "last_value",
                  col: "email",
                  over: {
                     orderBy: { email: "ASC" },
                     frame: "rows",
                     start: "unbounded preceding",
                     end: "unbounded following",
                  },
               },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.lastEmail).toBeDefined();
         const lastEmails = results.map((r) => r.lastEmail);
         // With full frame, last_value should be the largest email
         const sortedEmails = [...accounts].sort((a, b) => a.email.localeCompare(b.email));
         for (const le of lastEmails) {
            expect(le).toBe(sortedEmails[2]!.email);
         }
      });
   });

   describe("combined with other clauses", () => {
      test("windowBy + additional WHERE filter", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds}) and ${Account.$status} = ${"created"}`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               rowNum: { fn: "row_number", over: { orderBy: { email: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.rowNum).toBeDefined();
         const rowNums = results.map((r) => r.rowNum);
         expect(rowNums).toMatchInlineSnapshot(`
           [
             1,
             2,
             3,
           ]
         `);
      });

      test("windowBy + ORDER_BY (result set ordering)", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            ORDER_BY: sql`${Account.$email} desc`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               rowNum: { fn: "row_number", over: { orderBy: { email: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.rowNum).toBeDefined();
         // Results ordered by email DESC but rowNum was computed with email ASC
         // So first result (highest email) should have rowNum = 3
         const first = results[0]!;
         const last = results[2]!;
         expect(first.rowNum).toBe(3);
         expect(last.rowNum).toBe(1);
      });
   });

   describe("frame clauses", () => {
      test("ROWS BETWEEN N PRECEDING AND CURRENT ROW", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               recentCount: {
                  fn: "count",
                  col: "*",
                  over: {
                     orderBy: { email: "ASC" },
                     frame: "rows",
                     start: 1,
                     end: 0,
                  },
               },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.recentCount).toBeDefined();
         const counts = results.map((r) => r.recentCount as number);
         // ROWS BETWEEN 1 PRECEDING AND CURRENT ROW: row 0 → 1, row 1 → 2, row 2 → 2
         expect(counts).toMatchInlineSnapshot(`
           [
             1,
             2,
             2,
           ]
         `);
      });

      test("RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               runningCount: {
                  fn: "count",
                  col: "*",
                  over: {
                     orderBy: { email: "ASC" },
                     frame: "range",
                     start: "unbounded preceding",
                     end: "current row",
                  },
               },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.runningCount).toBeDefined();
         const counts = results.map((r) => r.runningCount as number);
         // With RANGE and unique orderBy values, acts like running count
         expect(counts).toMatchInlineSnapshot(`
           [
             1,
             2,
             3,
           ]
         `);
      });

      test("ROWS with numeric start and end bounds", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               windowCount: {
                  fn: "count",
                  col: "*",
                  over: {
                     orderBy: { email: "ASC" },
                     frame: "rows",
                     start: 1,
                     end: 1,
                  },
               },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.windowCount).toBeDefined();
         const counts = results.map((r) => r.windowCount as number);
         // ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING: row 0 → 2, row 1 → 3, row 2 → 2
         expect(counts).toMatchInlineSnapshot(`
           [
             2,
             3,
             2,
           ]
         `);
      });
   });

   describe("additional window functions", () => {
      test("percent_rank() execution", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               pctRank: { fn: "percent_rank", over: { orderBy: { email: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.pctRank).toBeDefined();
         const pctRanks = results.map((r) => r.pctRank as number);
         // percent_rank: first = 0, last = 1 for 3 distinct rows
         for (const val of pctRanks) {
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThanOrEqual(1);
         }
         // Should be [0, 0.5, 1] for 3 rows with unique values
         expect(pctRanks).toMatchInlineSnapshot(`
           [
             0,
             0.5,
             1,
           ]
         `);
      });

      test("cume_dist() execution", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               cumeDist: { fn: "cume_dist", over: { orderBy: { email: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.cumeDist).toBeDefined();
         const cumeDists = results.map((r) => r.cumeDist as number);
         // cume_dist: values between 0 (exclusive) and 1 (inclusive)
         for (const val of cumeDists) {
            expect(val).toBeGreaterThan(0);
            expect(val).toBeLessThanOrEqual(1);
         }
      });

      test("min() OVER — string min(email)", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               minEmail: { fn: "min", col: "email", over: { orderBy: { email: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.minEmail).toBeDefined();
         // With default frame (RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
         // min(email) ordered ASC is always the first email
         const sortedEmails = [...accounts].sort((a, b) => a.email.localeCompare(b.email));
         for (const row of results) {
            expect(row.minEmail).toBe(sortedEmails[0]!.email);
         }
      });

      test("max() OVER — string max(email)", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         const results = await sqlite3Select(Account, {
            WHERE: sql`${Account.$accountId} in (${accountIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               maxEmail: {
                  fn: "max",
                  col: "email",
                  over: {
                     orderBy: { email: "ASC" },
                     frame: "rows",
                     start: "unbounded preceding",
                     end: "unbounded following",
                  },
               },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(3);
         expect(results[0]!.maxEmail).toBeDefined();
         // With full frame, max(email) should be the largest email for all rows
         const sortedEmails = [...accounts].sort((a, b) => a.email.localeCompare(b.email));
         for (const row of results) {
            expect(row.maxEmail).toBe(sortedEmails[2]!.email);
         }
      });

      test("count(col) OVER — running count as aggregate", async () => {
         const orderIds = orders.map((o) => o.orderId);
         const results = await sqlite3Select(Order, {
            WHERE: sql`${Order.$orderId} in (${orderIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               runCount: { fn: "count", col: "orderId", over: { orderBy: { createdAt: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(6);
         expect(results[0]!.runCount).toBeDefined();
         const counts = results.map((r) => r.runCount as number);
         // Running count should be monotonically non-decreasing
         for (let i = 1; i < counts.length; i++) {
            expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!);
         }
         expect(counts[counts.length - 1]).toBe(6);
      });
   });

   describe("validation errors", () => {
      test("invalid function name throws", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         await expect(
            sqlite3Select(Account, {
               WHERE: sql`${Account.$accountId} in (${accountIds})`,
               limit: param<{ limit: number }>("limit"),
               windowBy: {
                  bad: { fn: "invalid_fn" as never, over: { orderBy: { email: "ASC" } } },
               },
            }).all({
               db,
               params: { limit: 100 },
            }),
         ).rejects.toThrow("invalid function");
      });

      test("col provided for ranking fn throws", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         await expect(
            sqlite3Select(Account, {
               WHERE: sql`${Account.$accountId} in (${accountIds})`,
               limit: param<{ limit: number }>("limit"),
               windowBy: {
                  bad: { fn: "row_number", col: "email", over: { orderBy: { email: "ASC" } } } as never,
               },
            }).all({
               db,
               params: { limit: 100 },
            }),
         ).rejects.toThrow("does not accept 'col'");
      });

      test("missing col for aggregate fn throws", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         await expect(
            sqlite3Select(Account, {
               WHERE: sql`${Account.$accountId} in (${accountIds})`,
               limit: param<{ limit: number }>("limit"),
               windowBy: {
                  bad: { fn: "sum", over: { orderBy: { email: "ASC" } } } as never,
               },
            }).all({
               db,
               params: { limit: 100 },
            }),
         ).rejects.toThrow("requires 'col'");
      });

      test("ntile without args throws", async () => {
         const accountIds = accounts.map((a) => a.accountId);
         await expect(
            sqlite3Select(Account, {
               WHERE: sql`${Account.$accountId} in (${accountIds})`,
               limit: param<{ limit: number }>("limit"),
               windowBy: {
                  bad: { fn: "ntile", over: { orderBy: { email: "ASC" } } } as never,
               },
            }).all({
               db,
               params: { limit: 100 },
            }),
         ).rejects.toThrow("ntile requires 'args'");
      });
   });

   describe("Order table — window functions on joined data", () => {
      test("row_number partitioned by accountId, ordered by createdAt", async () => {
         ok(orders.length > 0);
         const orderIds = orders.map((o) => o.orderId);
         const results = await sqlite3Select(Order, {
            WHERE: sql`${Order.$orderId} in (${orderIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               orderInAccount: {
                  fn: "row_number",
                  over: { partitionBy: ["accountId"], orderBy: { createdAt: "ASC" } },
               },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(6);
         expect(results[0]!.orderInAccount).toBeDefined();
         // Each account has 2 orders, so row_number within each partition is 1 or 2
         const rowNums = results.map((r) => r.orderInAccount as number);
         for (const rn of rowNums) {
            expect(rn).toBeGreaterThanOrEqual(1);
            expect(rn).toBeLessThanOrEqual(2);
         }
      });

      test("multiple window functions in single query", async () => {
         const orderIds = orders.map((o) => o.orderId);
         const results = await sqlite3Select(Order, {
            WHERE: sql`${Order.$orderId} in (${orderIds})`,
            limit: param<{ limit: number }>("limit"),
            windowBy: {
               rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } },
               runCount: { fn: "count", col: "*", over: { orderBy: { createdAt: "ASC" } } },
               tile: { fn: "ntile", args: 3, over: { orderBy: { createdAt: "ASC" } } },
            },
         }).all({
            db,
            params: { limit: 100 },
         });

         expect(results).toHaveLength(6);
         expect(results[0]!.rowNum).toBeDefined();
         expect(results[0]!.runCount).toBeDefined();
         expect(results[0]!.tile).toBeDefined();
         for (const r of results) {
            expect(typeof r.rowNum).toBe("number");
            expect(typeof r.runCount).toBe("number");
            expect(typeof r.tile).toBe("number");
         }
         // row_number should be sequential 1..6
         const rowNums = results.map((r) => r.rowNum as number);
         expect(rowNums).toMatchInlineSnapshot(`
           [
             1,
             2,
             3,
             4,
             5,
             6,
           ]
         `);
      });
   });

   describe("windowBy with joined tables", () => {
      test("windowBy with partitionBy on joined table column", async () => {
         const query = Order.join({ account: Account }).select({}).sqlite;
         const result = await query.all({
            db,
            params: {
               joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
               windowBy: {
                  accountRank: { fn: "rank", over: { partitionBy: ["account.email"], orderBy: { createdAt: "DESC" } } },
               },
            },
         });
         expect(result.length).toBeGreaterThan(0);
         const row = result[0]!;
         // @ts-expect-error — runtime window alias, not on static Row type
         expect(row.accountRank).toBeDefined();
         expect(row.orderId).toBeDefined();
         expect(row.accountId).toBeDefined();
         expect(row.createdAt).toBeDefined();
      });

      test("windowBy + select projection with joined columns", async () => {
         const query = Order.join({ account: Account }).select({}).sqlite;
         const result = await query.all({
            db,
            params: {
               joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
               windowBy: {
                  rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } },
               },
               select: { "account.email": "account.email", orderId: true },
            },
         });
         expect(result.length).toBeGreaterThan(0);
         const row = result[0]!;
         // @ts-expect-error — runtime window alias, not on static Row type
         expect(row.rowNum).toBeDefined();
         // @ts-expect-error — runtime window alias, not on static Row type
         expect(row.email).toBeDefined();
         expect(row.orderId).toBeDefined();
      });

      test("windowBy orderBy on joined table column", async () => {
         const query = Order.join({ account: Account }).select({}).sqlite;
         const result = await query.all({
            db,
            params: {
               joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
               windowBy: {
                  emailRank: { fn: "dense_rank", over: { orderBy: { "account.email": "ASC" } } },
               },
            },
         });
         expect(result.length).toBeGreaterThan(0);
         const row = result[0]!;
         // @ts-expect-error — runtime window alias, not on static Row type
         expect(row.emailRank).toBeDefined();
         expect(row.orderId).toBeDefined();
         expect(row.accountId).toBeDefined();
      });
   });
});
