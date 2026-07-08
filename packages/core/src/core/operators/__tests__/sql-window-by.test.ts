import { describe, expect, test } from "vitest";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { Account } from "@test-models/vexnor_dev.schema.js";
import { IAccountSelect } from "@test-models/vexnor_dev.account-table.js";
import { SqlWindowBy, windowBy, WindowBySelect } from "#src/core/operators/sql-window-by.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";


describe("SqlWindowBy — runtime window functions in SELECT list", () => {
   describe("ranking functions", () => {
      test("row_number with orderBy", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            rowNum: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
                 "a_1"."created_at" DESC
             ) AS "rowNum"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("rank function", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            rnk: { fn: "rank", over: { orderBy: { email: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             rank() OVER (
               ORDER BY
                 "a_1"."email" ASC
             ) AS "rnk"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("dense_rank function", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            denseRnk: { fn: "dense_rank", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             dense_rank() OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "denseRnk"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("percent_rank function", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            pctRnk: { fn: "percent_rank", over: { orderBy: { createdAt: "DESC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             percent_rank() OVER (
               ORDER BY
                 "a_1"."created_at" DESC
             ) AS "pctRnk"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("cume_dist function", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            cumeDist: { fn: "cume_dist", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             cume_dist() OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "cumeDist"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("bucket functions", () => {
      test("ntile with args", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            quartile: { fn: "ntile", args: 4, over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             ntile(4) OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "quartile"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("aggregate functions", () => {
      test("sum with col", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            runningTotal: { fn: "sum", col: "createdAt", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             sum("a_1"."created_at") OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "runningTotal"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("avg with col", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            avgVal: { fn: "avg", col: "createdAt", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             avg("a_1"."created_at") OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "avgVal"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("count with col", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            cnt: { fn: "count", col: "email", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             count("a_1"."email") OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "cnt"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("min with col", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            minVal: { fn: "min", col: "createdAt", over: { partitionBy: ["status"] } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             min("a_1"."created_at") OVER (
               PARTITION BY
                 "a_1"."status"
             ) AS "minVal"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("max with col", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            maxVal: { fn: "max", col: "createdAt", over: { partitionBy: ["status"] } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             max("a_1"."created_at") OVER (
               PARTITION BY
                 "a_1"."status"
             ) AS "maxVal"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("first_value with col", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            firstVal: { fn: "first_value", col: "email", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             first_value("a_1"."email") OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "firstVal"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("last_value with col", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            lastVal: { fn: "last_value", col: "email", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             last_value("a_1"."email") OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "lastVal"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("count with col = '*'", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            total: { fn: "count", col: "*", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             count(*) OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "total"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("offset functions", () => {
      test("lag with col and explicit args", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            prevEmail: { fn: "lag", col: "email", args: 2, over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             lag("a_1"."email", 2) OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "prevEmail"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("lead with col and default args (1)", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            nextEmail: { fn: "lead", col: "email", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             lead("a_1"."email", 1) OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "nextEmail"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("OVER clause", () => {
      test("partitionBy + orderBy combined", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            rowNum: { fn: "row_number", over: { partitionBy: ["status"], orderBy: { createdAt: "DESC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
               PARTITION BY
                 "a_1"."status"
               ORDER BY
                 "a_1"."created_at" DESC
             ) AS "rowNum"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("frame clause — ROWS BETWEEN", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            runningSum: {
               fn: "sum",
               col: "createdAt",
               over: {
                  orderBy: { createdAt: "ASC" },
                  frame: "rows",
                  start: "unbounded preceding",
                  end: "current row",
               },
            },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             sum("a_1"."created_at") OVER (
               ORDER BY
                 "a_1"."created_at" ASC ROWS BETWEEN UNBOUNDED PRECEDING
                 AND CURRENT ROW
             ) AS "runningSum"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("frame clause — RANGE BETWEEN", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            rangeSum: {
               fn: "sum",
               col: "createdAt",
               over: {
                  orderBy: { createdAt: "ASC" },
                  frame: "range",
                  start: "unbounded preceding",
                  end: "current row",
               },
            },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             sum("a_1"."created_at") OVER (
               ORDER BY
                 "a_1"."created_at" ASC RANGE BETWEEN UNBOUNDED PRECEDING
                 AND CURRENT ROW
             ) AS "rangeSum"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("frame with numeric preceding/following", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            movingAvg: {
               fn: "avg",
               col: "createdAt",
               over: {
                  orderBy: { createdAt: "ASC" },
                  frame: "rows",
                  start: 3,
                  end: 1,
               },
            },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             avg("a_1"."created_at") OVER (
               ORDER BY
                 "a_1"."created_at" ASC ROWS BETWEEN 3 PRECEDING
                 AND 1 FOLLOWING
             ) AS "movingAvg"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("multiple window columns", () => {
      test("multiple window functions in one query", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            rowNum: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } },
            runningCount: { fn: "count", col: "*", over: { orderBy: { createdAt: "ASC" } } },
            prevEmail: { fn: "lag", col: "email", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
                 "a_1"."created_at" DESC
             ) AS "rowNum",
             count(*) OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "runningCount",
             lag("a_1"."email", 1) OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "prevEmail"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("no output cases", () => {
      test("no windowBy param → no output", () => {
         const query = sqlSelect(Account, {});
         const { text, values } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."account_id" AS "accountId",
             "a_1"."status",
             "a_1"."email",
             "a_1"."first_name" AS "firstName",
             "a_1"."last_name" AS "lastName",
             "a_1"."notes",
             "a_1"."created_at" AS "createdAt",
             "a_1"."modified_at" AS "modifiedAt",
             "a_1"."parent_id" AS "parentId"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("empty windowBy object → no output", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {} }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."account_id" AS "accountId",
             "a_1"."status",
             "a_1"."email",
             "a_1"."first_name" AS "firstName",
             "a_1"."last_name" AS "lastName",
             "a_1"."notes",
             "a_1"."created_at" AS "createdAt",
             "a_1"."modified_at" AS "modifiedAt",
             "a_1"."parent_id" AS "parentId"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("null windowBy → no output", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: null }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."account_id" AS "accountId",
             "a_1"."status",
             "a_1"."email",
             "a_1"."first_name" AS "firstName",
             "a_1"."last_name" AS "lastName",
             "a_1"."notes",
             "a_1"."created_at" AS "createdAt",
             "a_1"."modified_at" AS "modifiedAt",
             "a_1"."parent_id" AS "parentId"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("validation", () => {
      test("invalid fn → throws", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            // @ts-expect-error — testing runtime validation of invalid function
            bad: { fn: "invalid_fn", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } })).toThrow("invalid function");
      });

      test("col provided to ranking fn → throws", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            // @ts-expect-error — ranking fn does not accept col
            bad: { fn: "row_number", col: "email", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } })).toThrow("does not accept 'col'");
      });

      test("col missing from aggregate fn → throws", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            // @ts-expect-error — aggregate/offset fn requires col
            bad: { fn: "sum", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } })).toThrow("requires 'col'");
      });

      test("col missing from offset fn → throws", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            // @ts-expect-error — aggregate/offset fn requires col
            bad: { fn: "lag", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } })).toThrow("requires 'col'");
      });

      test("col missing from lead fn → throws", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            // @ts-expect-error — aggregate/offset fn requires col
            bad: { fn: "lead", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } })).toThrow("requires 'col'");
      });

      test("args missing from ntile → throws", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            // @ts-expect-error — ntile requires args
            bad: { fn: "ntile", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } })).toThrow("ntile requires 'args'");
      });

      test("ntile args not positive integer → throws", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            bad: { fn: "ntile", args: -1, over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } })).toThrow("must be a positive integer");
      });

      test("ntile args is 0 → throws", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            bad: { fn: "ntile", args: 0, over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } })).toThrow("must be a positive integer");
      });

      test("ntile args is float → throws", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            bad: { fn: "ntile", args: 2.5, over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } })).toThrow("must be a positive integer");
      });

      test("invalid orderBy direction → throws", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            // @ts-expect-error — testing invalid direction
            bad: { fn: "row_number", over: { orderBy: { createdAt: "INVALID" } } },
         } }, options: { dialect: "sqlite" } })).toThrow("invalid orderBy direction");
      });

      test("frame start/end without frame type → throws", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            bad: { fn: "sum", col: "createdAt", over: { orderBy: { createdAt: "ASC" }, start: "unbounded preceding", end: "current row" } },
         } }, options: { dialect: "sqlite" } })).toThrow("'frame' (rows|range) is required");
      });

      test("invalid partitionBy column → throws", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            // @ts-expect-error — testing invalid column name
            bad: { fn: "row_number", over: { partitionBy: ["nonExistentColumn"], orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } })).toThrow("column 'nonExistentColumn' not found");
      });
   });

   describe("dialect variations", () => {
      test("sqlite dialect produces same output", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: { rowNum: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
                 "a_1"."created_at" DESC
             ) AS "rowNum"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("transactsql dialect produces same output", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: { rowNum: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } } }, options: { dialect: "transactsql" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
                 "a_1"."created_at" DESC
             ) AS "rowNum"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("postgresql dialect", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: { rowNum: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } } }, options: { dialect: "postgresql" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
                 "a_1"."created_at" DESC
             ) AS "rowNum"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("coverage: serialization path (!context.params)", () => {
      test("emits operator token when context.params is null", () => {
         const op = new SqlWindowBy(Account, "windowBy");
         const context = new SqlBuildContext({ dialect: "sqlite", params: null });
         op.write(context);
         const opToken = context.tokens.find((t) => t.type === "operator");
         expect(opToken).toMatchInlineSnapshot(`
           {
             "operator": {
               "columns": {
                 "accountId": ""a_1"."account_id"",
                 "createdAt": ""a_1"."created_at"",
                 "email": ""a_1"."email"",
                 "firstName": ""a_1"."first_name"",
                 "lastName": ""a_1"."last_name"",
                 "modifiedAt": ""a_1"."modified_at"",
                 "notes": ""a_1"."notes"",
                 "parentId": ""a_1"."parent_id"",
                 "status": ""a_1"."status"",
               },
               "param": "windowBy",
               "type": "windowBy",
             },
             "type": "operator",
           }
         `);
      });

      test("aiPrompt getter returns description string", () => {
         const op = new SqlWindowBy(Account, "windowBy");
         expect(op.aiPrompt).toMatchInlineSnapshot(`"windowBy: { "alias": { fn, over: { partitionBy?, orderBy?, frame?, start?, end? }, col?, args? } }. Ranking fns (no col): row_number, rank, dense_rank, percent_rank, cume_dist. Bucket fn: ntile (args = bucket count). Aggregate fns (col required): sum, avg, count, min, max, first_value, last_value. Offset fns (col required): lag, lead (args = offset, default 1)."`);
      });
   });

   describe("coverage: context.getColumn() resolution", () => {
      test("resolves column from context columnMap when columnCount > 0", () => {
         const op = new SqlWindowBy(Account, "windowBy");
         const context = new SqlBuildContext({
            dialect: "sqlite",
            params: {
               windowBy: { runningSum: { fn: "sum", col: "email", over: { orderBy: { createdAt: "ASC" } } } },
            },
         });
         context.setAlias(Account.tableInfo, { alias: "a_1" });
         context.addColumns({ email: Account.$email, createdAt: Account.$createdAt });
         op.write(context);
         expect(context.text).toMatchInlineSnapshot(`
           ",
           sum("a_1"."email") OVER (
             ORDER BY
               "a_1"."created_at" ASC
           ) AS "runningSum""
         `);
      });

      test("falls through to table.cols when column not in columnMap", () => {
         const op = new SqlWindowBy(Account, "windowBy");
         const context = new SqlBuildContext({
            dialect: "sqlite",
            params: {
               windowBy: { runningSum: { fn: "sum", col: "status", over: { orderBy: { email: "ASC" } } } },
            },
         });
         context.setAlias(Account.tableInfo, { alias: "a_1" });
         // Only add "email" to columnMap so "status" won't be found via getColumn
         context.addColumns({ email: Account.$email });
         op.write(context);
         expect(context.text).toMatchInlineSnapshot(`
           ",
           sum("a_1"."status") OVER (
             ORDER BY
               "a_1"."email" ASC
           ) AS "runningSum""
         `);
      });
   });

   describe("coverage: dot-notation column reference", () => {
      test("resolves dot-notation column (account.createdAt)", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            // @ts-expect-error — dot-notation resolved at runtime, not a direct column key
            runningSum: { fn: "sum", col: "account.createdAt", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             sum("a_1"."created_at") OVER (
               ORDER BY
                 "a_1"."created_at" ASC
             ) AS "runningSum"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("throws for dot-notation column not found in table", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            // @ts-expect-error — testing invalid column name
            bad: { fn: "sum", col: "other.nonExistent", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } })).toThrow("column 'other.nonExistent' not found");
      });
   });

   describe("coverage: unknown column validation error", () => {
      test("throws when column not in table or fieldNames", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            // @ts-expect-error — testing invalid column name
            bad: { fn: "sum", col: "nonExistentColumn", over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } })).toThrow("column 'nonExistentColumn' not found");
      });
   });

   describe("coverage: fallback quoted identifier", () => {
      test("emits quoted identifier when col is in fieldNames but not in table.cols", () => {
         const op = new SqlWindowBy(Account, "windowBy", [...Account.colKeys, "customField"]);
         const context = new SqlBuildContext({
            dialect: "sqlite",
            params: {
               windowBy: { total: { fn: "sum", col: "customField", over: { orderBy: { createdAt: "ASC" } } } },
            },
         });
         context.setAlias(Account.tableInfo, { alias: "a_1" });
         op.write(context);
         expect(context.text).toMatchInlineSnapshot(`
           ",
           sum("customField") OVER (
             ORDER BY
               "a_1"."created_at" ASC
           ) AS "total""
         `);
      });
   });

   describe("coverage: multiple partitionBy columns", () => {
      test("emits comma separator between multiple partitionBy columns", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            rowNum: { fn: "row_number", over: { partitionBy: ["status", "email"], orderBy: { createdAt: "DESC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
               PARTITION BY
                 "a_1"."status",
                 "a_1"."email"
               ORDER BY
                 "a_1"."created_at" DESC
             ) AS "rowNum"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("emits comma separator between multiple orderBy columns", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            rowNum: { fn: "row_number", over: { orderBy: { createdAt: "DESC", email: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
                 "a_1"."created_at" DESC,
                 "a_1"."email" ASC
             ) AS "rowNum"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("coverage: formatFrameBound with bound === 0", () => {
      test("start: 0 emits 'current row'", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            movingAvg: {
               fn: "avg",
               col: "createdAt",
               over: {
                  orderBy: { createdAt: "ASC" },
                  frame: "rows",
                  start: 0,
                  end: 3,
               },
            },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             avg("a_1"."created_at") OVER (
               ORDER BY
                 "a_1"."created_at" ASC ROWS BETWEEN CURRENT ROW
                 AND 3 FOLLOWING
             ) AS "movingAvg"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("end: 0 emits 'current row'", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            movingAvg: {
               fn: "avg",
               col: "createdAt",
               over: {
                  orderBy: { createdAt: "ASC" },
                  frame: "rows",
                  start: 3,
                  end: 0,
               },
            },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             avg("a_1"."created_at") OVER (
               ORDER BY
                 "a_1"."created_at" ASC ROWS BETWEEN 3 PRECEDING
                 AND CURRENT ROW
             ) AS "movingAvg"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("frame with only start specified (end defaults to 'unbounded following')", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            runSum: {
               fn: "sum",
               col: "createdAt",
               over: {
                  orderBy: { createdAt: "ASC" },
                  frame: "rows",
                  start: "unbounded preceding",
               },
            },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             sum("a_1"."created_at") OVER (
               ORDER BY
                 "a_1"."created_at" ASC ROWS BETWEEN UNBOUNDED PRECEDING
                 AND UNBOUNDED FOLLOWING
             ) AS "runSum"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("frame with only end specified (start defaults to 'unbounded preceding')", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            runSum: {
               fn: "sum",
               col: "createdAt",
               over: {
                  orderBy: { createdAt: "ASC" },
                  frame: "rows",
                  end: "current row",
               },
            },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             sum("a_1"."created_at") OVER (
               ORDER BY
                 "a_1"."created_at" ASC ROWS BETWEEN UNBOUNDED PRECEDING
                 AND CURRENT ROW
             ) AS "runSum"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("coverage: frame clause without orderBy/partitionBy (hasContent=false)", () => {
      test("frame clause emitted without leading space when no partitionBy/orderBy", () => {
         const { text, values } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            runSum: {
               fn: "sum",
               col: "createdAt",
               over: {
                  frame: "rows",
                  start: "unbounded preceding",
                  end: "current row",
               },
            },
         } }, options: { dialect: "sqlite" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             sum("a_1"."created_at") OVER (
               ROWS BETWEEN UNBOUNDED PRECEDING
               AND CURRENT ROW
             ) AS "runSum"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("coverage: MSSQL RANGE + numeric bounds validation", () => {
      test("MSSQL RANGE frame with numeric start throws", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            bad: {
               fn: "sum",
               col: "createdAt",
               over: {
                  orderBy: { createdAt: "ASC" },
                  frame: "range",
                  start: 3,
                  end: "current row",
               },
            },
         } }, options: { dialect: "transactsql" } })).toThrow("MSSQL does not support numeric bounds with RANGE frame");
      });

      test("MSSQL RANGE frame with numeric end throws", () => {
         expect(() => sqlSelect(Account, {}).getSql({ params: { windowBy: {
            bad: {
               fn: "sum",
               col: "createdAt",
               over: {
                  orderBy: { createdAt: "ASC" },
                  frame: "range",
                  start: "unbounded preceding",
                  end: 5,
               },
            },
         } }, options: { dialect: "transactsql" } })).toThrow("MSSQL does not support numeric bounds with RANGE frame");
      });

      test("MSSQL RANGE frame with numeric start via tsql dialect throws", () => {
         const op = new SqlWindowBy(Account, "windowBy");
         const context = new SqlBuildContext({
            dialect: "tsql",
            params: {
               windowBy: {
                  bad: {
                     fn: "sum",
                     col: "createdAt",
                     over: {
                        orderBy: { createdAt: "ASC" },
                        frame: "range",
                        start: 3,
                        end: "current row",
                     },
                  },
               },
            },
         });
         context.setAlias(Account.tableInfo, { alias: "a_1" });
         expect(() => op.write(context)).toThrow("MSSQL does not support numeric bounds with RANGE frame");
      });

      test("PostgreSQL RANGE frame with numeric bounds succeeds (not MSSQL)", () => {
         const { text } = sqlSelect(Account, {}).getSql({ params: { windowBy: {
            rangeNum: {
               fn: "sum",
               col: "createdAt",
               over: {
                  orderBy: { createdAt: "ASC" },
                  frame: "range",
                  start: 5,
                  end: 3,
               },
            },
         } }, options: { dialect: "postgresql" } });
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
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
             sum("a_1"."created_at") OVER (
               ORDER BY
                 "a_1"."created_at" ASC RANGE BETWEEN 5 preceding
                 AND 3 following
             ) AS "rangeNum"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });
   });

   describe("coverage: windowBy() factory function", () => {
      test("windowBy() factory creates instance with default param name", () => {
         const instance = windowBy(Account);
         expect(instance.paramName).toBe("windowBy");
         expect(instance.table).toBe(Account);
         expect(instance).toBeInstanceOf(SqlWindowBy);
      });

      test("windowBy() factory accepts custom param name", () => {
         const instance = windowBy(Account, "customWindow");
         expect(instance.paramName).toBe("customWindow");
      });

      test("windowBy() factory accepts custom fieldNames", () => {
         const instance = windowBy(Account, "windowBy", ["email", "status", "customCol"]);
         expect(instance.fieldNames).toMatchInlineSnapshot(`
           [
             "email",
             "status",
             "customCol",
           ]
         `);
      });
   });

   describe("type-level column constraints", () => {
      test("valid columns in col, partitionBy, orderBy — compiles and executes", () => {
         sqlSelect(Account, {}).getSql({ params: { windowBy: {
            r1: { fn: "rank", over: { partitionBy: ["status"], orderBy: { createdAt: "DESC" } } },
            r2: { fn: "row_number", over: { partitionBy: ["email", "firstName"], orderBy: { modifiedAt: "ASC" } } },
            a1: { fn: "sum", col: "createdAt", over: { orderBy: { email: "ASC" } } },
            a2: { fn: "max", col: "lastName", over: { partitionBy: ["status"] } },
            o1: { fn: "lag", col: "email", args: 1, over: { orderBy: { createdAt: "ASC" } } },
            o2: { fn: "lead", col: "parentId", over: { orderBy: { accountId: "DESC" } } },
            b1: { fn: "ntile", args: 4, over: { orderBy: { createdAt: "ASC" } } },
         } }, options: { dialect: "sqlite" } });
      });

      test("invalid column in col — type error", () => {
         // @ts-expect-error — type-level test, value is intentionally unused
         // eslint-disable-next-line unused-imports/no-unused-vars
         const check: WindowBySelect<{ Select: IAccountSelect }> = {
            // @ts-expect-error — 'doesNotExist' is not a column on Account
            bad: { fn: "sum", col: "doesNotExist", over: { orderBy: { createdAt: "ASC" } } },
         };
      });

      test("invalid column in partitionBy — type error", () => {
         const check = {
            // @ts-expect-error — 'doesNotExist' is not a column on Account
            bad: { fn: "rank", over: { partitionBy: ["doesNotExist"], orderBy: { createdAt: "ASC" } } },
         } satisfies WindowBySelect<{ Select: IAccountSelect }>;
         void check;
      });

      test("invalid column in orderBy — type error", () => {
         // @ts-expect-error — type-level test, value is intentionally unused
         // eslint-disable-next-line unused-imports/no-unused-vars
         const check: WindowBySelect<{ Select: IAccountSelect }> = {
            // @ts-expect-error — 'doesNotExist' is not a column on Account
            bad: { fn: "row_number", over: { orderBy: { doesNotExist: "ASC" } } },
         };
      });

      test("mix of valid and invalid columns — type error on invalid", () => {
         void ({
            good: { fn: "rank", over: { partitionBy: ["status"], orderBy: { createdAt: "ASC" } } },
            // @ts-expect-error — 'fakeCol' is not a column on Account
            bad: { fn: "sum", col: "fakeCol", over: { orderBy: { createdAt: "ASC" } } },
         } satisfies WindowBySelect<{ Select: IAccountSelect }>);
      });
   });
});
