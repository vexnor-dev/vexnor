// noinspection SqlNoDataSourceInspection,SqlResolve
import { beforeAll, describe, expect, test } from "vitest";
import { param } from "@vexnor/core";
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
         expect(results[0]).toHaveProperty("rowNum");
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
         expect(results[0]).toHaveProperty("rnk");
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
         expect(results[0]).toHaveProperty("denseRnk");
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
         expect(results[0]).toHaveProperty("runningCount");
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
         expect(results[0]).toHaveProperty("prevEmail");
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
         expect(results[0]).toHaveProperty("nextEmail");
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
         expect(results[0]).toHaveProperty("quartile");
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
         expect(results[0]).toHaveProperty("firstEmail");
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
         expect(results[0]).toHaveProperty("lastEmail");
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
         expect(results[0]).toHaveProperty("runningTotal");
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
         expect(results[0]).toHaveProperty("rowNum");
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
         expect(results[0]).toHaveProperty("rowNum");
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
         expect(results[0]).toHaveProperty("rowNum");
         expect(results[0]).toHaveProperty("rnk");
         expect(results[0]).toHaveProperty("runningCount");
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
         expect(results[0]).toHaveProperty("movingCount");
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
         expect(results[0]).toHaveProperty("rangeCount");
         const counts = results.map((r) => toNum(r.rangeCount)).sort((a, b) => a - b);
         // RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW → monotonically increasing
         expect(counts[0]).toBeGreaterThanOrEqual(1);
         for (let i = 1; i < counts.length; i++) {
            expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]!);
         }
      });
   });

   describe("additional window functions", () => {
      test("percent_rank() execution", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  pctRank: { fn: "percent_rank", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         expect(results[0]).toHaveProperty("pctRank");
         for (const row of results) {
            const val = Number(row.pctRank);
            // percent_rank is between 0 and 1
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThanOrEqual(1);
         }
      });

      test("cume_dist() execution", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  cumeDist: { fn: "cume_dist", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         expect(results[0]).toHaveProperty("cumeDist");
         for (const row of results) {
            const val = Number(row.cumeDist);
            // cume_dist is between 0 (exclusive) and 1 (inclusive)
            expect(val).toBeGreaterThan(0);
            expect(val).toBeLessThanOrEqual(1);
         }
      });

      test("min() OVER — string min(email)", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  minEmail: { fn: "min", col: "email", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         expect(results[0]).toHaveProperty("minEmail");
         // min(email) with default frame (RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
         // should always be a string
         for (const row of results) {
            expect(typeof row.minEmail).toBe("string");
         }
      });

      test("max() OVER — string max(email)", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  maxEmail: { fn: "max", col: "email", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);
         expect(results[0]).toHaveProperty("maxEmail");
         for (const row of results) {
            expect(typeof row.maxEmail).toBe("string");
         }
      });
   });

   describe("query text snapshot", () => {
      test("windowBy generates correct SQL", () => {
         const query = Account.postgres.select({
            WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
         });
         const { text, values } = query.source.getSql({
            params: {
               id: "test-id",
               windowBy: {
                  rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } },
                  runSum: { fn: "count", col: "*", over: { partitionBy: ["status"], orderBy: { createdAt: "ASC" } } },
               },
            },
            options: { dialect: "postgresql" },
         });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           /* driver: postgres */
           SELECT
             "a_1"."account_id" AS "accountId",
             "a_1"."status",
             "a_1"."email",
             "a_1"."first_name" AS "firstName",
             "a_1"."last_name" AS "lastName",
             "a_1"."notes",
             "a_1"."created_at" AS "createdAt",
             "a_1"."modified_at" AS "modifiedAt",
             "a_1"."parent_id" AS "parentId",
             row_number() OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "rowNum",
             count(*) OVER (
               PARTITION BY
                 "a_1"."status"
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "runSum"
           FROM
             "vexnor_dev"."account" AS "a_1"
             /* <query_1> */
           WHERE
             /* <query_2> */ "a_1"."account_id" = $1 /* </query_2> */ /* </query_1> */
             /* <query_3> */
             /* </query_3> */
             /* <query_4> */
             /* </query_4> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "test-id",
           ]
         `);
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

   describe("result row type — current limitation (#64)", () => {
      test("window fields exist at runtime but require cast to access without type error", async () => {
         const results = await Account.postgres.select({
            WHERE: sql`${Account.$email} like ${`%${dataManager.TAG}%`}`,
         }).all({
            db: pool,
            params: {
               windowBy: {
                  myRank: { fn: "rank", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results.length).toBeGreaterThanOrEqual(3);

         const row = results[0]!;

         // Base row fields — typed, no cast needed
         expect(row.email).toBeDefined();
         expect(row.accountId).toBeDefined();

         // Window field — exists at runtime
         // Note: currently typed as part of the row due to params intersection
         expect(row.myRank).toBeDefined();
         expect(typeof row.myRank === "number" || typeof row.myRank === "string").toBe(true);
      });
   });
});
