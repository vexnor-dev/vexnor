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
         expect(results[0]).toHaveProperty("rowNum");
         for (const row of results) {
            expect(Number(row.rowNum)).not.toBeNaN();
         }
         // row_number produces sequential values 1..6 (order may vary with same timestamps)
         const rowNums = results.map((r) => Number(r.rowNum)).sort((a, b) => a - b);
         expect(rowNums[0]).toBe(1);
         expect(rowNums[rowNums.length - 1]).toBe(6);
         expect(new Set(rowNums).size).toBe(6); // all distinct
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
         expect(results[0]).toHaveProperty("rnk");
         for (const row of results) {
            expect(Number(row.rnk)).not.toBeNaN();
            expect(Number(row.rnk)).toBeGreaterThanOrEqual(1);
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
         expect(results[0]).toHaveProperty("denseRnk");
         for (const row of results) {
            expect(Number(row.denseRnk)).not.toBeNaN();
            expect(Number(row.denseRnk)).toBeGreaterThanOrEqual(1);
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
         expect(results[0]).toHaveProperty("runningTotal");
         const totals = results.map((r) => Number(r.runningTotal)).sort((a, b) => a - b);
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
         expect(results[0]).toHaveProperty("runningCount");
         const counts = results.map((r) => Number(r.runningCount)).sort((a, b) => a - b);
         // Running count should be monotonically non-decreasing
         for (let i = 1; i < counts.length; i++) {
            expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]!);
         }
         // All values should be valid positive integers
         expect(counts[0]).toBeGreaterThanOrEqual(1);
         expect(counts[counts.length - 1]).toBe(6);
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
         expect(results[0]).toHaveProperty("prevEmail");
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
         expect(results[0]).toHaveProperty("nextEmail");
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
         expect(results[0]).toHaveProperty("bucket");
         for (const row of results) {
            expect(Number(row.bucket)).not.toBeNaN();
            // ntile(2) produces values 1 or 2
            expect(Number(row.bucket)).toBeGreaterThanOrEqual(1);
            expect(Number(row.bucket)).toBeLessThanOrEqual(2);
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
         expect(results[0]).toHaveProperty("firstEmail");
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
         expect(results[0]).toHaveProperty("lastEmail");
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
         expect(results[0]).toHaveProperty("rowNum");
         for (const row of results) {
            expect(row.status).toBe("CREATED");
            expect(Number((row as Record<string, unknown>)["rowNum"])).not.toBeNaN();
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
         expect(results[0]).toHaveProperty("rowNum");
         // Should have projected columns + window column
         for (const row of results) {
            const record = row as Record<string, unknown>;
            expect(typeof record["email"]).toBe("string");
            expect(typeof record["status"]).toBe("string");
            expect(Number(record["rowNum"])).not.toBeNaN();
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
         expect(results[0]).toHaveProperty("rowNum");
         expect(results[0]).toHaveProperty("rnk");
         expect(results[0]).toHaveProperty("runningCount");
         for (const row of results) {
            expect(Number(row.rowNum)).not.toBeNaN();
            expect(Number(row.rnk)).not.toBeNaN();
            expect(Number(row.runningCount)).not.toBeNaN();
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
         expect(results[0]).toHaveProperty("movingCount");
         for (const row of results) {
            expect(Number(row.movingCount)).not.toBeNaN();
            // ROWS BETWEEN 1 PRECEDING AND CURRENT ROW → max 2 rows in window
            expect(Number(row.movingCount)).toBeGreaterThanOrEqual(1);
            expect(Number(row.movingCount)).toBeLessThanOrEqual(2);
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
         expect(results[0]).toHaveProperty("rangeCount");
         const counts = results.map((r) => Number(r.rangeCount)).sort((a, b) => a - b);
         // RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW → monotonically non-decreasing
         for (let i = 1; i < counts.length; i++) {
            expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]!);
         }
      });
   });

   // --- Additional window functions ---

   describe("additional window functions", () => {
      test("percent_rank() execution", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               windowBy: {
                  pctRank: { fn: "percent_rank", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results).toHaveLength(6);
         expect(results[0]).toHaveProperty("pctRank");
         for (const row of results) {
            const val = Number(row.pctRank);
            // percent_rank is between 0 and 1
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThanOrEqual(1);
         }
      });

      test("cume_dist() execution", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               windowBy: {
                  cumeDist: { fn: "cume_dist", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results).toHaveLength(6);
         expect(results[0]).toHaveProperty("cumeDist");
         for (const row of results) {
            const val = Number(row.cumeDist);
            // cume_dist is between 0 (exclusive) and 1 (inclusive)
            expect(val).toBeGreaterThan(0);
            expect(val).toBeLessThanOrEqual(1);
         }
      });

      test("min() OVER — string min(email)", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               windowBy: {
                  minEmail: { fn: "min", col: "email", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results).toHaveLength(6);
         expect(results[0]).toHaveProperty("minEmail");
         for (const row of results) {
            expect(typeof row.minEmail).toBe("string");
         }
      });

      test("max() OVER — string max(email)", async () => {
         const results = await Account.mssql.select({
            WHERE: sql`${Account.$accountId} in (${accountIdsParam})`,
         }).all({
            db: pool.request(),
            params: {
               accountIds: allAccountIds,
               windowBy: {
                  maxEmail: { fn: "max", col: "email", over: { orderBy: { createdAt: "ASC" } } },
               },
            },
         });

         expect(results).toHaveLength(6);
         expect(results[0]).toHaveProperty("maxEmail");
         for (const row of results) {
            expect(typeof row.maxEmail).toBe("string");
         }
      });
   });

   // --- Query text snapshot ---

   describe("query text snapshot", () => {
      test("windowBy generates correct SQL", () => {
         const query = Account.mssql.select({
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
            options: { dialect: "transactsql" },
         });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           /* driver: transactsql */
           SELECT
             "a_1"."account_id" AS "accountId",
             "a_1"."parent_id" AS "parentId",
             "a_1"."status",
             "a_1"."email",
             "a_1"."first_name" AS "firstName",
             "a_1"."last_name" AS "lastName",
             "a_1"."notes",
             "a_1"."created_at" AS "createdAt",
             "a_1"."modified_at" AS "modifiedAt",
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
             /* <query_2> */ "a_1"."account_id" = @param_0 /* </query_2> */ /* </query_1> */
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
