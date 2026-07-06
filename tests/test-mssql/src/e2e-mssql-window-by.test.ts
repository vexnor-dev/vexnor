import { beforeAll, describe, expect, test } from "vitest";
import { param } from "@vexnor/core";
import { sql } from "@vexnor/mssql";
import "@vexnor/mssql";
import { Account, Order } from "./codegen/vexnor_dev.schema.js";
import { pool } from "./mssql-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("vexnor mssql window functions (windowBy)", async (ctx) => {
   const dataManager = new TestDataManager(ctx, {
      ACCOUNT_ROOT_COUNT: 3,
      ACCOUNT_CHILD_FACTOR: 1,
      ACCOUNT_ORDER_FACTOR: 2,
   });

   const accountIdsParam = param<{ accountIds: string[] }>("accountIds");

   let allAccountIds: string[] = [];

   beforeAll(async () => {
      await dataManager.initRootAccounts(pool);
      await dataManager.initChildAccounts(pool);
      await dataManager.initOrders(pool);
      allAccountIds = [...dataManager.rootAccounts, ...dataManager.childAccounts].map((a) => a.accountId);
   });

   // --- Basic window functions execution ---

   describe("basic window functions", () => {
      test("row_number() with orderBy", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               windowBy: {
                  rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results).toHaveLength(6);
         for (const row of results) {
            expect(typeof row.rowNum).toBe("number");
         }
         // row_number produces sequential values 1..6
         const rowNums = results.map((r) => r.rowNum as number).sort((a, b) => a - b);
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

      test("rank() with partitionBy + orderBy", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               windowBy: {
                  rnk: { fn: "rank", over: { partitionBy: ["status"], orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results).toHaveLength(6);
         for (const row of results) {
            expect(typeof row.rnk).toBe("number");
            expect(row.rnk as number).toBeGreaterThanOrEqual(1);
         }
      });

      test("dense_rank() with orderBy", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               windowBy: {
                  denseRnk: { fn: "dense_rank", over: { orderBy: { email: "ASC" } } },
               },
            },
         });

         expect(results).toHaveLength(6);
         for (const row of results) {
            expect(typeof row.denseRnk).toBe("number");
            expect(row.denseRnk as number).toBeGreaterThanOrEqual(1);
         }
      });

      test("sum() OVER (running total via count)", async () => {
         const results = await Order.mssql.select({
            WHERE: sql`${Order.$accountId} in (${accountIdsParam})`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: dataManager.rootAccounts.map((a) => a.accountId),
               windowBy: {
                  runningTotal: { fn: "count", col: "orderId", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         // 3 accounts × 2 orders = 6 orders
         expect(results).toHaveLength(6);
         const totals = results.map((r) => r.runningTotal as number).sort((a, b) => a - b);
         // Running count is monotonically increasing
         for (let i = 1; i < totals.length; i++) {
            expect(totals[i]).toBeGreaterThanOrEqual(totals[i - 1]!);
         }
      });

      test("count(*) OVER — running count", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               windowBy: {
                  runningCount: { fn: "count", col: "*", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results).toHaveLength(6);
         const counts = results.map((r) => r.runningCount as number).sort((a, b) => a - b);
         // Running count should be monotonically increasing: 1..6
         for (let i = 1; i < counts.length; i++) {
            expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]!);
         }
         expect(counts).toMatchInlineSnapshot(`
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

      test("lag() with offset", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
            ORDER_BY: sql`${Account.$email} asc`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               windowBy: {
                  prevEmail: { fn: "lag", col: "email", args: 1, over: { orderBy: { email: "ASC" } } },
               },
            },
         });

         expect(results).toHaveLength(6);
         // First row should have null lag
         const prevEmails = results.map((r) => r.prevEmail);
         expect(prevEmails[0]).toBeNull();
         // Subsequent lag values should be the previous row's email
         for (let i = 1; i < results.length; i++) {
            expect(prevEmails[i]).toBe(results[i - 1]!.email);
         }
      });

      test("lead() with offset", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
            ORDER_BY: sql`${Account.$email} asc`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               windowBy: {
                  nextEmail: { fn: "lead", col: "email", args: 1, over: { orderBy: { email: "ASC" } } },
               },
            },
         });

         expect(results).toHaveLength(6);
         // Last row should have null lead
         const nextEmails = results.map((r) => r.nextEmail);
         expect(nextEmails[results.length - 1]).toBeNull();
         // Previous lead values should be the next row's email
         for (let i = 0; i < results.length - 1; i++) {
            expect(nextEmails[i]).toBe(results[i + 1]!.email);
         }
      });

      test("ntile() with args", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               windowBy: {
                  bucket: { fn: "ntile", args: 2, over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results).toHaveLength(6);
         for (const row of results) {
            expect(typeof row.bucket).toBe("number");
            // ntile(2) produces values 1 or 2
            expect(row.bucket as number).toBeGreaterThanOrEqual(1);
            expect(row.bucket as number).toBeLessThanOrEqual(2);
         }
      });

      test("first_value() with col", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
            ORDER_BY: sql`${Account.$email} asc`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               windowBy: {
                  firstEmail: { fn: "first_value", col: "email", over: { orderBy: { email: "ASC" } } },
               },
            },
         });

         expect(results).toHaveLength(6);
         // All rows should have the same first_value (the first email alphabetically)
         const firstValues = results.map((r) => r.firstEmail);
         expect(new Set(firstValues).size).toBe(1);
         expect(typeof firstValues[0]).toBe("string");
      });

      test("last_value() with col and frame", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
            ORDER_BY: sql`${Account.$email} asc`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
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
            },
         });

         expect(results).toHaveLength(6);
         // With full frame, all rows see the same last_value
         const lastValues = results.map((r) => r.lastEmail);
         expect(new Set(lastValues).size).toBe(1);
         expect(typeof lastValues[0]).toBe("string");
      });
   });

   // --- Combined with other params ---

   describe("combined with other params", () => {
      test("windowBy + filterBy together", async () => {
         const query = Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
         });

         const results = await query.all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               filterBy: [{ status: ["=", "CREATED"] }],
               windowBy: {
                  rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } },
               },
            } as never,
         });

         // All test accounts are created with status 'CREATED'
         expect(results).toHaveLength(6);
         for (const row of results) {
            expect(row.status).toBe("CREATED");
            expect(typeof (row as Record<string, unknown>)["rowNum"]).toBe("number");
         }
      });

      test("windowBy + select (projection with windows)", async () => {
         const query = Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
         });

         const results = await query.all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               select: {
                  email: true,
                  status: true,
               },
               windowBy: {
                  rowNum: { fn: "row_number", over: { orderBy: { email: "ASC" } } },
               },
            } as never,
         });

         expect(results).toHaveLength(6);
         // Should have projected columns + window column
         for (const row of results) {
            const record = row as Record<string, unknown>;
            expect(typeof record["email"]).toBe("string");
            expect(typeof record["status"]).toBe("string");
            expect(typeof record["rowNum"]).toBe("number");
         }
      });

      test("windowBy with multiple window functions", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               windowBy: {
                  rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } },
                  rnk: { fn: "rank", over: { orderBy: { createdAt: "ASC" } } },
                  runningCount: { fn: "count", col: "*", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results).toHaveLength(6);
         for (const row of results) {
            expect(typeof row.rowNum).toBe("number");
            expect(typeof row.rnk).toBe("number");
            expect(typeof row.runningCount).toBe("number");
         }
      });
   });

   // --- Frame clauses ---

   describe("frame clauses", () => {
      test("ROWS BETWEEN N PRECEDING AND CURRENT ROW", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
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

         expect(results).toHaveLength(6);
         for (const row of results) {
            expect(typeof row.movingCount).toBe("number");
            // ROWS BETWEEN 1 PRECEDING AND CURRENT ROW → max 2 rows in window
            expect(row.movingCount as number).toBeGreaterThanOrEqual(1);
            expect(row.movingCount as number).toBeLessThanOrEqual(2);
         }
      });

      test("RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW (valid for MSSQL without numeric bounds)", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
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

         expect(results).toHaveLength(6);
         const counts = results.map((r) => r.rangeCount as number).sort((a, b) => a - b);
         // RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW → monotonically non-decreasing
         for (let i = 1; i < counts.length; i++) {
            expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]!);
         }
      });
   });

   // --- MSSQL-specific validation ---

   describe("MSSQL-specific validation", () => {
      test("RANGE frame with numeric bound should THROW (MSSQL restriction)", async () => {
         await expect(
            Account.mssql.select({
               WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
            }).all({
               db: pool.request(),
               params: {
                  accountIds: allAccountIds,
                  windowBy: {
                     bad: {
                        fn: "sum",
                        col: "email",
                        over: {
                           orderBy: { createdAt: "ASC" },
                           frame: "range",
                           start: 3,
                           end: "current row",
                        },
                     },
                  },
               },
            }),
         ).rejects.toThrow("MSSQL does not support numeric bounds with RANGE frame");
      });
   });

   // --- General validation errors ---

   describe("general validation errors", () => {
      test("invalid function name → throws", async () => {
         await expect(
            Account.mssql.select({
               WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
            }).all({
               db: pool.request(),
               params: {
                  accountIds: allAccountIds,
                  windowBy: {
                     bad: { fn: "invalid_fn" as never, over: { orderBy: { createdAt: "ASC" } } },
                  },
               },
            }),
         ).rejects.toThrow("invalid function");
      });

      test("missing col for aggregate fn → throws", async () => {
         await expect(
            Account.mssql.select({
               WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
            }).all({
               db: pool.request(),
               params: {
                  accountIds: allAccountIds,
                  windowBy: {
                     bad: { fn: "sum", over: { orderBy: { createdAt: "ASC" } } } as never,
                  },
               },
            }),
         ).rejects.toThrow("requires 'col'");
      });

      test("col provided for ranking fn → throws", async () => {
         await expect(
            Account.mssql.select({
               WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
            }).all({
               db: pool.request(),
               params: {
                  accountIds: allAccountIds,
                  windowBy: {
                     bad: { fn: "row_number", col: "email", over: { orderBy: { createdAt: "ASC" } } } as never,
                  },
               },
            }),
         ).rejects.toThrow("does not accept 'col'");
      });

      test("ntile without args → throws", async () => {
         await expect(
            Account.mssql.select({
               WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
            }).all({
               db: pool.request(),
               params: {
                  accountIds: allAccountIds,
                  windowBy: {
                     bad: { fn: "ntile", over: { orderBy: { createdAt: "ASC" } } } as never,
                  },
               },
            }),
         ).rejects.toThrow("ntile requires 'args'");
      });
   });
});
