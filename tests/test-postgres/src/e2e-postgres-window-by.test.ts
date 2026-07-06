// noinspection SqlNoDataSourceInspection,SqlResolve
import { beforeAll, describe, expect, test } from "vitest";
import { sql } from "@vexnor/postgres";
import "@vexnor/postgres";
import { Account, Order } from "./codegen/vexnor_dev.schema.js";
import { pool } from "./postgres-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("vexnor postgres window functions (windowBy)", async (ctx) => {
   const dataManager = new TestDataManager(ctx, {
      ACCOUNT_ROOT_COUNT: 3,
      ACCOUNT_CHILD_FACTOR: 0,
      ACCOUNT_ORDER_FACTOR: 2,
   });

   beforeAll(async () => {
      await dataManager.initRootAccounts(pool);
      await dataManager.initOrders(pool);
   });

   // Helper: pg returns bigint window results as strings; parse to number for assertions
   function toNum(val: unknown): number {
      return Number(val);
   }

   describe("basic window functions", () => {
      test("row_number() with orderBy", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         for (const row of results) {
            // pg returns bigint as string
            expect(toNum(row.rowNum)).toBeGreaterThanOrEqual(1);
         }
         // row_number produces sequential values starting from 1
         const rowNums = results.map((r) => toNum(r.rowNum)).sort((a, b) => a - b);
         expect(rowNums[0]).toBe(1);
         expect(rowNums[rowNums.length - 1]).toBe(results.length);
      });

      test("rank() with partitionBy + orderBy", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  rnk: { fn: "rank", over: { partitionBy: ["status"], orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         for (const row of results) {
            expect(toNum(row.rnk)).toBeGreaterThanOrEqual(1);
         }
      });

      test("dense_rank() with orderBy", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  denseRnk: { fn: "dense_rank", over: { orderBy: { email: "ASC" } } },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         for (const row of results) {
            expect(toNum(row.denseRnk)).toBeGreaterThanOrEqual(1);
         }
      });

      test("count(*) OVER — running count", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  runningCount: { fn: "count", col: "*", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         const counts = results.map((r) => toNum(r.runningCount)).sort((a, b) => a - b);
         // Running count should be monotonically non-decreasing
         expect(counts[0]).toBeGreaterThanOrEqual(1);
         for (let i = 1; i < counts.length; i++) {
            expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]!);
         }
         // Final count equals total rows (all rows are included in unbounded frame)
         expect(counts[counts.length - 1]).toBe(results.length);
      });

      test("lag() with offset", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  prevEmail: { fn: "lag", col: "email", args: 1, over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         // At least one row should have a null prevEmail (the first row in the window)
         const hasNull = results.some((r) => r.prevEmail === null);
         expect(hasNull).toBe(true);
         // Non-null values should be strings (emails)
         for (const row of results) {
            if (row.prevEmail !== null) {
               expect(typeof row.prevEmail).toBe("string");
            }
         }
      });

      test("lead() with offset", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  nextEmail: { fn: "lead", col: "email", args: 1, over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         // At least one row should have a null nextEmail (the last row in the window)
         const hasNull = results.some((r) => r.nextEmail === null);
         expect(hasNull).toBe(true);
         for (const row of results) {
            if (row.nextEmail !== null) {
               expect(typeof row.nextEmail).toBe("string");
            }
         }
      });

      test("ntile() with args", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  quartile: { fn: "ntile", args: 2, over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         for (const row of results) {
            // ntile(2) produces values 1 or 2
            expect(toNum(row.quartile)).toBeGreaterThanOrEqual(1);
            expect(toNum(row.quartile)).toBeLessThanOrEqual(2);
         }
      });

      test("first_value() with col", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  firstEmail: { fn: "first_value", col: "email", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         // All rows should have the same first_value (the email of the earliest-created account)
         const firstValues = results.map((r) => r.firstEmail);
         expect(new Set(firstValues).size).toBe(1);
         expect(typeof firstValues[0]).toBe("string");
      });

      test("last_value() with col and frame", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  lastEmail: {
                     fn: "last_value",
                     col: "email",
                     over: {
                        orderBy: { createdAt: "ASC" },
                        frame: "rows",
                        start: "unbounded preceding",
                        end: "unbounded following",
                     },
                  },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         // With full frame, all rows see the same last_value
         const lastValues = results.map((r) => r.lastEmail);
         expect(new Set(lastValues).size).toBe(1);
         expect(typeof lastValues[0]).toBe("string");
      });

      test("sum() OVER — running total (count col on Orders)", async () => {
         const accountIds = dataManager.rootAccounts.map((a) => a.accountId);
         const results = await Order.postgres.select({
            WHERE: sql`${Order.$accountId} in (${accountIds})`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  runningTotal: { fn: "count", col: "orderId", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         // 3 accounts × 2 orders = 6 orders (at minimum)
         expect(results.length).toBeGreaterThanOrEqual(6);
         const totals = results.map((r) => toNum(r.runningTotal)).sort((a, b) => a - b);
         // Running count is monotonically non-decreasing
         expect(totals[0]).toBeGreaterThanOrEqual(1);
         for (let i = 1; i < totals.length; i++) {
            expect(totals[i]).toBeGreaterThanOrEqual(totals[i - 1]!);
         }
      });
   });

   describe("combined with other params", () => {
      test("windowBy + filterBy together", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               filterBy: [{ status: "created" }],
               windowBy: {
                  rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         // All test accounts are created with status 'created'
         expect(results.length).toBeGreaterThanOrEqual(3);
         for (const row of results) {
            expect(row.status).toBe("created");
            expect(toNum(row.rowNum)).toBeGreaterThanOrEqual(1);
         }
      });

      test("windowBy + orderBy (sort results by createdAt)", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  rowNum: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } },
               },
               orderBy: { createdAt: "DESC" },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         // row_number ordered DESC should yield sequential 1, 2, 3... since both window and sort are DESC
         const rowNums = results.map((r) => toNum(r.rowNum));
         for (let i = 0; i < rowNums.length; i++) {
            expect(rowNums[i]).toBe(i + 1);
         }
      });

      test("windowBy with multiple window functions", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } },
                  rnk: { fn: "rank", over: { orderBy: { createdAt: "ASC" } } },
                  runningCount: { fn: "count", col: "*", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         for (const row of results) {
            expect(toNum(row.rowNum)).toBeGreaterThanOrEqual(1);
            expect(toNum(row.rnk)).toBeGreaterThanOrEqual(1);
            expect(toNum(row.runningCount)).toBeGreaterThanOrEqual(1);
         }
      });
   });

   describe("frame clauses", () => {
      test("ROWS BETWEEN N PRECEDING AND CURRENT ROW", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  movingCount: {
                     fn: "count",
                     col: "*",
                     over: {
                        orderBy: { createdAt: "ASC" },
                        frame: "rows",
                        start: 1,
                        end: 0,
                     },
                  },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         for (const row of results) {
            // ROWS BETWEEN 1 PRECEDING AND CURRENT ROW → max 2 rows in window
            expect(toNum(row.movingCount)).toBeGreaterThanOrEqual(1);
            expect(toNum(row.movingCount)).toBeLessThanOrEqual(2);
         }
      });

      test("RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  rangeCount: {
                     fn: "count",
                     col: "*",
                     over: {
                        orderBy: { createdAt: "ASC" },
                        frame: "range",
                        start: "unbounded preceding",
                        end: "current row",
                     },
                  },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         const counts = results.map((r) => toNum(r.rangeCount)).sort((a, b) => a - b);
         // RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW → monotonically increasing
         expect(counts[0]).toBeGreaterThanOrEqual(1);
         for (let i = 1; i < counts.length; i++) {
            expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]!);
         }
      });
   });

   describe("validation errors", () => {
      test("invalid function name → throws", async () => {
         await expect(
            Account.postgres.select({
               WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
            }).all({
               db: pool,
               params: {
                  windowBy: {
                     bad: { fn: "invalid_fn" as never, over: { orderBy: { createdAt: "ASC" } } },
                  },
               },
            }),
         ).rejects.toThrow("invalid function");
      });

      test("missing col for aggregate fn → throws", async () => {
         await expect(
            Account.postgres.select({
               WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
            }).all({
               db: pool,
               params: {
                  windowBy: {
                     bad: { fn: "sum", over: { orderBy: { createdAt: "ASC" } } } as never,
                  },
               },
            }),
         ).rejects.toThrow("requires 'col'");
      });

      test("col provided for ranking fn → throws", async () => {
         await expect(
            Account.postgres.select({
               WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
            }).all({
               db: pool,
               params: {
                  windowBy: {
                     bad: { fn: "row_number", col: "email", over: { orderBy: { createdAt: "ASC" } } } as never,
                  },
               },
            }),
         ).rejects.toThrow("does not accept 'col'");
      });

      test("ntile without args → throws", async () => {
         await expect(
            Account.postgres.select({
               WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
            }).all({
               db: pool,
               params: {
                  windowBy: {
                     bad: { fn: "ntile", over: { orderBy: { createdAt: "ASC" } } } as never,
                  },
               },
            }),
         ).rejects.toThrow("ntile requires 'args'");
      });

      test("frame start/end without frame type → throws", async () => {
         await expect(
            Account.postgres.select({
               WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
            }).all({
               db: pool,
               params: {
                  windowBy: {
                     bad: {
                        fn: "count",
                        col: "*",
                        over: { orderBy: { createdAt: "ASC" }, start: "unbounded preceding", end: "current row" },
                     } as never,
                  },
               },
            }),
         ).rejects.toThrow("'frame' (rows|range) is required");
      });
   });
});
