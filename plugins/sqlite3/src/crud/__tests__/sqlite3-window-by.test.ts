import { describe, expect, test } from "vitest";
import { Account } from "@vexnor/core/testing";
import "@vexnor/sqlite3";
import { defaultQueryOptions } from "#src/crud/default-query-options.js";

function buildWindowBy(windowBy: Record<string, unknown>) {
   const query = Account.sqlite.select({});
   return query.source.getSql({
      params: { windowBy } as never,
      options: defaultQueryOptions,
   });
}

describe("Account.sqlite.select() — windowBy SQL generation", () => {
   // --- Ranking (5) ---

   test("row_number with orderBy", () => {
      const { text, values } = buildWindowBy({ rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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

   test("rank with partitionBy + orderBy", () => {
      const { text, values } = buildWindowBy({ rnk: { fn: "rank", over: { partitionBy: ["status"], orderBy: { createdAt: "ASC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
            PARTITION BY
              "a_1"."status"
            ORDER BY
              "a_1"."created_at" ASC
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

   test("dense_rank with orderBy", () => {
      const { text, values } = buildWindowBy({ denseRnk: { fn: "dense_rank", over: { orderBy: { createdAt: "ASC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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

   test("percent_rank with orderBy", () => {
      const { text, values } = buildWindowBy({ pctRnk: { fn: "percent_rank", over: { orderBy: { createdAt: "ASC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
              "a_1"."created_at" ASC
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

   test("cume_dist with orderBy", () => {
      const { text, values } = buildWindowBy({ cumeDist: { fn: "cume_dist", over: { orderBy: { createdAt: "ASC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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

   // --- Bucket (1) ---

   test("ntile with args=4", () => {
      const { text, values } = buildWindowBy({ quartile: { fn: "ntile", args: 4, over: { orderBy: { createdAt: "ASC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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

   // --- Aggregate (9) ---

   test("sum with col + orderBy", () => {
      const { text, values } = buildWindowBy({ runningSum: { fn: "sum", col: "createdAt", over: { orderBy: { createdAt: "ASC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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

   test("avg with col + orderBy", () => {
      const { text, values } = buildWindowBy({ runningAvg: { fn: "avg", col: "createdAt", over: { orderBy: { createdAt: "ASC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
          ) AS "runningAvg"
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

   test("count with col + orderBy", () => {
      const { text, values } = buildWindowBy({ cnt: { fn: "count", col: "email", over: { orderBy: { createdAt: "ASC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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

   test("count with col=*", () => {
      const { text, values } = buildWindowBy({ cntAll: { fn: "count", col: "*", over: { orderBy: { createdAt: "ASC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
          ) AS "cntAll"
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

   test("min with col + partitionBy", () => {
      const { text, values } = buildWindowBy({ minVal: { fn: "min", col: "createdAt", over: { partitionBy: ["status"] } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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

   test("max with col + partitionBy", () => {
      const { text, values } = buildWindowBy({ maxVal: { fn: "max", col: "createdAt", over: { partitionBy: ["status"] } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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

   test("first_value with col + orderBy", () => {
      const { text, values } = buildWindowBy({ firstVal: { fn: "first_value", col: "email", over: { orderBy: { createdAt: "ASC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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

   test("last_value with col + orderBy + frame", () => {
      const { text, values } = buildWindowBy({ lastVal: { fn: "last_value", col: "email", over: { orderBy: { createdAt: "ASC" }, frame: "rows", start: "unbounded preceding", end: "unbounded following" } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
              "a_1"."created_at" ASC ROWS BETWEEN UNBOUNDED PRECEDING
              AND UNBOUNDED FOLLOWING
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

   // --- Offset (2) ---

   test("lag with col + args + orderBy", () => {
      const { text, values } = buildWindowBy({ prevEmail: { fn: "lag", col: "email", args: 2, over: { orderBy: { createdAt: "ASC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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

   test("lead with col + orderBy (default args)", () => {
      const { text, values } = buildWindowBy({ nextEmail: { fn: "lead", col: "email", over: { orderBy: { createdAt: "ASC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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

   // --- Over clause variations (4) ---

   test("partitionBy only", () => {
      const { text, values } = buildWindowBy({ cnt: { fn: "count", col: "email", over: { partitionBy: ["status"] } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
            PARTITION BY
              "a_1"."status"
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

   test("orderBy only", () => {
      const { text, values } = buildWindowBy({ rowNum: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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

   test("partitionBy + orderBy combined", () => {
      const { text, values } = buildWindowBy({ rnk: { fn: "rank", over: { partitionBy: ["status"], orderBy: { createdAt: "DESC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
            PARTITION BY
              "a_1"."status"
            ORDER BY
              "a_1"."created_at" DESC
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

   test("multiple partitionBy columns", () => {
      const { text, values } = buildWindowBy({ rnk: { fn: "rank", over: { partitionBy: ["status", "email"], orderBy: { createdAt: "ASC" } } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
            PARTITION BY
              "a_1"."status",
              "a_1"."email"
            ORDER BY
              "a_1"."created_at" ASC
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

   // --- Frame clauses (4) ---

   test("ROWS BETWEEN N PRECEDING AND CURRENT ROW", () => {
      const { text, values } = buildWindowBy({ runningSum: { fn: "sum", col: "createdAt", over: { orderBy: { createdAt: "ASC" }, frame: "rows", start: 3, end: 0 } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
              "a_1"."created_at" ASC ROWS BETWEEN 3 PRECEDING
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

   test("ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING", () => {
      const { text, values } = buildWindowBy({ total: { fn: "sum", col: "createdAt", over: { orderBy: { createdAt: "ASC" }, frame: "rows", start: "unbounded preceding", end: "unbounded following" } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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

   test("RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW", () => {
      const { text, values } = buildWindowBy({ runningSum: { fn: "sum", col: "createdAt", over: { orderBy: { createdAt: "ASC" }, frame: "range", start: "unbounded preceding", end: "current row" } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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

   test("ROWS with start=0 (current row)", () => {
      const { text, values } = buildWindowBy({ windowSum: { fn: "sum", col: "createdAt", over: { orderBy: { createdAt: "ASC" }, frame: "rows", start: 0, end: 5 } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
              "a_1"."created_at" ASC ROWS BETWEEN CURRENT ROW
              AND 5 FOLLOWING
          ) AS "windowSum"
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

   // --- Combined (2) ---

   test("multiple window functions in one query", () => {
      const { text, values } = buildWindowBy({
         rowNum: { fn: "row_number", over: { orderBy: { createdAt: "ASC" } } },
         rnk: { fn: "rank", over: { partitionBy: ["status"], orderBy: { createdAt: "ASC" } } },
         total: { fn: "sum", col: "createdAt", over: { orderBy: { createdAt: "ASC" } } },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
          rank() OVER (
            PARTITION BY
              "a_1"."status"
            ORDER BY
              "a_1"."created_at" ASC
          ) AS "rnk",
          sum("a_1"."created_at") OVER (
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

   test("windowBy with empty object (no output)", () => {
      const { text, values } = buildWindowBy({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
