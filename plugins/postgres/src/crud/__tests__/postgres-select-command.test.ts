// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import { newSqlTable, SqlLiteralType } from "@vexnor/core";
import { PostgresProjectBy } from "#src/crud/postgres-select-command.js";
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
