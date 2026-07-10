// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import { newSqlTable, SqlLiteralType, sql, row } from "@vexnor/core";
import { Account, Order } from "@vexnor/core/testing";
import { PostgresSelectCommand } from "#src/crud/postgres-select-command.js";
import { defaultQueryOptions } from "#src/default-query-options.js";

/**
 * Inline test table with a boolean column and a numeric column.
 */
const Task = newSqlTable<{
   Name: "task";
   Select: { taskId: string; title: string; isCompleted: boolean; priority: number };
   Insert: { taskId?: string; title: string; isCompleted?: boolean; priority?: number };
   Update: { title?: string; isCompleted?: boolean; priority?: number };
   Delete: true;
}>({
   crud: { select: true, insert: true, update: true, delete: true },
   tableInfo: { name: "task", schema: "public", alias: null, out: false },
   pk: ["taskId"],
   columns: {
      taskId: "task_id",
      title: "title",
      isCompleted: "is_completed",
      priority: "priority",
   },
   dbSchema: {
      taskId: { dbType: "uuid", type: SqlLiteralType.String },
      title: { dbType: "varchar", type: SqlLiteralType.String },
      isCompleted: { dbType: "boolean", type: SqlLiteralType.Boolean },
      priority: { dbType: "integer", type: SqlLiteralType.Number },
   },
});

describe("PostgresProjectBy — boolean column cast", () => {
   test("SUM on a boolean column produces sum(col::int)", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { completedSum: { fn: "sum", col: "isCompleted" } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          sum("t_1"."is_completed"::int) AS "completedSum"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("AVG on a boolean column produces avg(col::int)", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { completedAvg: { fn: "avg", col: "isCompleted" } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          avg("t_1"."is_completed"::int) AS "completedAvg"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("SUM on a numeric column does NOT add ::int", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { prioritySum: { fn: "sum", col: "priority" } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          sum("t_1"."priority") AS "prioritySum"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("COUNT on a boolean column does NOT add ::int (only sum/avg)", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { completedCount: { fn: "count", col: "isCompleted" } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          count("t_1"."is_completed") AS "completedCount"
        FROM
          "public"."task" AS "t_1"
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

describe("PostgresProjectBy — write() branches", () => {
   test("write() without params delegates to parent (operator emission mode)", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      // Call with empty params — triggers the no-select-param branch
      const { text } = query.getSql({ params: {}, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          "t_1"."task_id" AS "taskId",
          "t_1"."title",
          "t_1"."is_completed" AS "isCompleted",
          "t_1"."priority"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("write() with empty select param delegates to parent (emit all columns)", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({ params: { select: {} }, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          "t_1"."task_id" AS "taskId",
          "t_1"."title",
          "t_1"."is_completed" AS "isCompleted",
          "t_1"."priority"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("write() with value=true emits column by name", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { title: true, priority: true } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          "t_1"."title",
          "t_1"."priority"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("write() with string value renames column", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { myTitle: "title" } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          "t_1"."title" AS "myTitle"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("write() throws on invalid select entry value", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      expect(() =>
         query.getSql({
            // @ts-expect-error — testing invalid runtime value for error path
            params: { select: { bad: 42 } },
            options: defaultQueryOptions,
         }),
      ).toThrow("Invalid select entry for alias 'bad'");
   });
});

describe("PostgresProjectBy — transform functions", () => {
   test("dateTrunc with postgres dialect", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { period: { fn: "dateTrunc", col: "priority", args: "month" } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          date_trunc('month', "t_1"."priority") AS "period"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("dateTrunc throws on invalid granularity", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      expect(() =>
         query.getSql({
            params: { select: { period: { fn: "dateTrunc", col: "priority", args: "century" } } },
            options: defaultQueryOptions,
         }),
      ).toThrow('Invalid dateTrunc granularity: "century"');
   });

   test("coalesce with single fallback value", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text, values } = query.getSql({
         params: { select: { prio: { fn: "coalesce", col: "priority", args: 0 } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          coalesce("t_1"."priority", $1) AS "prio"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          0,
        ]
      `);
   });

   test("coalesce with multiple fallback values", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text, values } = query.getSql({
         params: { select: { prio: { fn: "coalesce", col: "priority", args: [10, 20] } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          coalesce("t_1"."priority", $1, $2) AS "prio"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          10,
          20,
        ]
      `);
   });

   test("round with precision", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { rounded: { fn: "round", col: "priority", args: 2 } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          round("t_1"."priority", 2) AS "rounded"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("round without precision", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { rounded: { fn: "round", col: "priority" } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          round("t_1"."priority") AS "rounded"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("round throws on invalid precision", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      expect(() =>
         query.getSql({
            params: { select: { rounded: { fn: "round", col: "priority", args: "bad" } } },
            options: defaultQueryOptions,
         }),
      ).toThrow("Invalid round precision");
   });

   test("abs function", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { absPrio: { fn: "abs", col: "priority" } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          abs("t_1"."priority") AS "absPrio"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("concat function (postgres dialect)", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text, values } = query.getSql({
         params: { select: { full: { fn: "concat", col: "title", args: [" - ", "suffix"] } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          "t_1"."title" || $1 || $2 AS "full"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          " - ",
          "suffix",
        ]
      `);
   });

   test("unsupported transform throws", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      expect(() =>
         query.getSql({
            // @ts-expect-error — testing unsupported fn name for error path
            params: { select: { x: { fn: "unknownFn", col: "priority" } } },
            options: defaultQueryOptions,
         }),
      ).toThrow("Unsupported transform: unknownFn");
   });

   test("column not found throws", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      expect(() =>
         query.getSql({
            params: { select: { x: { fn: "abs", col: "nonExistent" } } },
            options: defaultQueryOptions,
         }),
      ).toThrow("Column not found: nonExistent");
   });

   test("count(*) aggregate with star", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { total: { fn: "count", col: "*" } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          count(*) AS "total"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("min aggregate function", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { lowest: { fn: "min", col: "priority" } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          min("t_1"."priority") AS "lowest"
        FROM
          "public"."task" AS "t_1"
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

describe("PostgresSelectCommand — constructor and buildPostgres()", () => {
   test("constructor without includes produces basic query", () => {
      const command = new PostgresSelectCommand(Account, {});
      const handler = command.buildPostgres();
      expect(handler).toBeDefined();
   });

   test("buildPostgres returns handler with source", () => {
      const command = new PostgresSelectCommand(Account, {});
      const handler = command.buildPostgres();
      expect(handler.source).toBeDefined();
   });

   test("constructor with includeOne produces lateral join", () => {
      const firstOrder = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         WHERE ${Order.$accountId} = ${Account.$accountId}
      `;
      const command = new PostgresSelectCommand(Account, { includeOne: { firstOrder } });
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: defaultQueryOptions });
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
          "query_1_result" AS "firstOrder"
        FROM
          "main"."account" AS "a_1" /* <query_3> */
          /* inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(to_jsonb("query_1".*), NULL) AS "query_1_result"
            FROM
              (
                /* <query_1> */
                SELECT
                  "query_2".*
                FROM
                  (
                    /* <query_2> */
                    SELECT
                      "o_2"."order_id" AS "orderId",
                      "o_2"."status",
                      "o_2"."created_at" AS "createdAt",
                      "o_2"."modified_at" AS "modifiedAt",
                      "o_2"."account_id" AS "accountId"
                    FROM
                      "main"."order" AS "o_2"
                    WHERE
                      "o_2"."account_id" = "a_3"."account_id"
                      /* </query_2> */
                  ) AS "query_2"
                LIMIT
                  1 /* </query_1> */
              ) AS "query_1"
          ) AS "query_1" ON TRUE
          /* </query_3> */
          /* <query_4> */
          /* </query_4> */
          /* <query_5> */
          /* </query_5> */
          /* <query_6> */
          /* </query_6> */
          /* </query_0> */"
      `);
   });

   test("constructor with includeMany produces lateral join", () => {
      const orders = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         WHERE ${Order.$accountId} = ${Account.$accountId}
      `;
      const command = new PostgresSelectCommand(Account, { includeMany: { orders } });
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: defaultQueryOptions });
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
          "query_1_result" AS "orders"
        FROM
          "main"."account" AS "a_1" /* <query_2> */
          /* inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(jsonb_agg("query_1".*), '[]') AS "query_1_result"
            FROM
              (
                /* <query_1> */
                SELECT
                  "o_2"."order_id" AS "orderId",
                  "o_2"."status",
                  "o_2"."created_at" AS "createdAt",
                  "o_2"."modified_at" AS "modifiedAt",
                  "o_2"."account_id" AS "accountId"
                FROM
                  "main"."order" AS "o_2"
                WHERE
                  "o_2"."account_id" = "a_3"."account_id"
                  /* </query_1> */
              ) AS "query_1"
          ) AS "query_1" ON TRUE
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* <query_4> */
          /* </query_4> */
          /* <query_5> */
          /* </query_5> */
          /* </query_0> */"
      `);
   });
});

describe("PostgresProjectBy — dialect-specific branches", () => {
   test("dateTrunc with sqlite dialect uses strftime", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { period: { fn: "dateTrunc", col: "priority", args: "day" } } },
         options: { ...defaultQueryOptions, dialect: "sqlite" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          strftime('%Y-%m-%d', "t_1"."priority") AS "period"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("dateTrunc with transactsql dialect uses DATETRUNC", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { period: { fn: "dateTrunc", col: "priority", args: "year" } } },
         options: { ...defaultQueryOptions, dialect: "transactsql" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          DATETRUNC (year, "t_1"."priority") AS "period"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("dateTrunc with tsql dialect uses DATETRUNC", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { period: { fn: "dateTrunc", col: "priority", args: "hour" } } },
         options: { ...defaultQueryOptions, dialect: "tsql" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          DATETRUNC (hour, "t_1"."priority") AS "period"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("concat with transactsql dialect uses CONCAT function", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const tsqlOptions = { ...defaultQueryOptions, dialect: "transactsql" as const, paramFormat: ({ index }: { index: number }) => `@p${index}` };
      const { text, values } = query.getSql({
         params: { select: { full: { fn: "concat", col: "title", args: [" - ", "end"] } } },
         options: tsqlOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          CONCAT("t_1"."title", @p0, @p1) AS "full"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          " - ",
          "end",
        ]
      `);
   });

   test("concat with single arg (non-array)", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text, values } = query.getSql({
         params: { select: { full: { fn: "concat", col: "title", args: "!" } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          "t_1"."title" || $1 AS "full"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "!",
        ]
      `);
   });

   test("round with precision in array format", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { rounded: { fn: "round", col: "priority", args: [3] } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          round("t_1"."priority", 3) AS "rounded"
        FROM
          "public"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("aggregate with dot-notation column reference", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      const { text } = query.getSql({
         params: { select: { total: { fn: "sum", col: "task.priority" } } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          sum("t_1"."priority") AS "total"
        FROM
          "public"."task" AS "t_1"
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

describe("PostgresProjectBy — remaining branch coverage", () => {
   test("column with dot.notation prefix in pgResolveColumn", () => {
      const command = new PostgresSelectCommand(Task, {});
      const query = command.build();
      // Use task.title — the pgResolveColumn will strip the prefix and find "title"
      const { text } = query.getSql({
         params: { select: { t: "task.title" } },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        SELECT
          "t_1"."title" AS "t"
        FROM
          "public"."task" AS "t_1"
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
