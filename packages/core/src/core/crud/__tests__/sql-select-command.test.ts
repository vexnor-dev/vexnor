// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import { Account, Order } from "@test-models/vexnor_dev.schema.js";
import { SqlSelectCommand } from "#src/core/crud/sql-select-command.js";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { sql } from "#src/core/sql.js";
import { input } from "#src/core/query/sql-input.js";

describe("SqlSelectCommand.build()", () => {
   describe("basic args (no WHERE, no JOIN)", () => {
      test("produces same SQL as sqlSelect() with empty args", () => {
         const command = new SqlSelectCommand(Account, {});
         const queryFromCommand = command.build();
         const queryFromFn = sqlSelect(Account, {});

         const commandResult = queryFromCommand.getSql({ params: {}, options: { dialect: "sqlite" } });
         const fnResult = queryFromFn.getSql({ params: {}, options: { dialect: "sqlite" } });

         expect(commandResult.text).toBe(fnResult.text);
         expect(commandResult.values).toMatchInlineSnapshot(`[]`);
         expect(commandResult.text).toMatchInlineSnapshot(`
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
      });
   });

   describe("with WHERE clause", () => {
      test("produces same SQL as sqlSelect() with WHERE", () => {
         const params = input<{ id: string }>();
         const args = { WHERE: sql`${Account.$accountId} = ${params.$id}` };

         const command = new SqlSelectCommand(Account, args);
         const queryFromCommand = command.build();
         const queryFromFn = sqlSelect(Account, args);

         const commandResult = queryFromCommand.getSql({ params: { id: "test-id" }, options: { dialect: "sqlite" } });
         const fnResult = queryFromFn.getSql({ params: { id: "test-id" }, options: { dialect: "sqlite" } });

         expect(commandResult.text).toBe(fnResult.text);
         expect(commandResult.text).toMatchInlineSnapshot(`
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
           WHERE
             /* <query_2> */ "a_1"."account_id" = ? /* </query_2> */ /* </query_1> */
             /* <query_3> */
             /* </query_3> */
             /* <query_4> */
             /* </query_4> */
             /* </query_0> */"
         `);
      });
   });

   describe("with filterBy, orderBy, limit/offset params", () => {
      test("produces same SQL as sqlSelect() with runtime filter + order + pagination", () => {
         const command = new SqlSelectCommand(Account, {});
         const queryFromCommand = command.build();
         const queryFromFn = sqlSelect(Account, {});

         const runtimeParams = {
            filterBy: [{ email: ["like", "%@test.com"] }],
            orderBy: { createdAt: "DESC" },
            limit: 10,
            offset: 5,
         };

         // @ts-expect-error — runtime params use operator tuple format
         const commandResult = queryFromCommand.getSql({ params: runtimeParams, options: { dialect: "sqlite" } });
         // @ts-expect-error — runtime params use operator tuple format
         const fnResult = queryFromFn.getSql({ params: runtimeParams, options: { dialect: "sqlite" } });

         expect(commandResult.text).toBe(fnResult.text);
         expect(commandResult.text).toMatchInlineSnapshot(`
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
           WHERE
             "a_1"."email" like ? /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
           ORDER BY
             "a_1"."created_at" DESC
           LIMIT
             ?
           OFFSET
             ?
             /* </query_0> */"
         `);
         expect(commandResult.values).toMatchInlineSnapshot(`
           [
             "%@test.com",
             10,
             5,
           ]
         `);
      });
   });

   describe("with projection (select param with aggregates + transforms)", () => {
      test("produces same SQL as sqlSelect() with projection param", () => {
         const command = new SqlSelectCommand(Account, {});
         const queryFromCommand = command.build();
         const queryFromFn = sqlSelect(Account, {});

         const runtimeParams = {
            select: {
               status: true,
               total: { fn: "count", col: "*" },
               earliest: { fn: "min", col: "createdAt" },
            },
         };

         // @ts-expect-error — runtime select param with fn entries
         const commandResult = queryFromCommand.getSql({ params: runtimeParams, options: { dialect: "sqlite" } });
         // @ts-expect-error — runtime select param with fn entries
         const fnResult = queryFromFn.getSql({ params: runtimeParams, options: { dialect: "sqlite" } });

         expect(commandResult.text).toBe(fnResult.text);
         expect(commandResult.text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."status",
             count(*) AS "total",
             min("a_1"."created_at") AS "earliest"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
           GROUP BY
             "a_1"."status" /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(commandResult.values).toMatchInlineSnapshot(`[]`);
      });

      test("produces same SQL as sqlSelect() with dateTrunc transform", () => {
         const command = new SqlSelectCommand(Account, {});
         const queryFromCommand = command.build();
         const queryFromFn = sqlSelect(Account, {});

         const runtimeParams = {
            select: {
               period: { fn: "dateTrunc", col: "createdAt", args: "month" },
               total: { fn: "count", col: "*" },
            },
         };

         // @ts-expect-error — runtime select param with fn entries
         const commandResult = queryFromCommand.getSql({ params: runtimeParams, options: { dialect: "sqlite" } });
         // @ts-expect-error — runtime select param with fn entries
         const fnResult = queryFromFn.getSql({ params: runtimeParams, options: { dialect: "sqlite" } });

         expect(commandResult.text).toBe(fnResult.text);
         expect(commandResult.text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             strftime('%Y-%m-01', "a_1"."created_at") AS "period",
             count(*) AS "total"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
           GROUP BY
             strftime('%Y-%m-01', "a_1"."created_at") /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });
   });

   describe("with joinMap (dot-notation columns)", () => {
      test("produces same SQL as sqlSelect() with joinMap and dot-notation orderBy", () => {
         const joinMap = { order: Order };

         const command = new SqlSelectCommand(Account, {}, null, joinMap);
         const queryFromCommand = command.build();
         const queryFromFn = sqlSelect(Account, {}, null, joinMap);

         const runtimeParams = {
            orderBy: { "order.createdAt": "DESC" },
         };

         // @ts-expect-error — runtime dot-notation orderBy
         const commandResult = queryFromCommand.getSql({ params: runtimeParams, options: { dialect: "sqlite" } });
         // @ts-expect-error — runtime dot-notation orderBy
         const fnResult = queryFromFn.getSql({ params: runtimeParams, options: { dialect: "sqlite" } });

         expect(commandResult.text).toBe(fnResult.text);
         expect(commandResult.text).toMatchInlineSnapshot(`
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
           ORDER BY
             "o_2"."created_at" DESC
             /* </query_0> */"
         `);
      });

      test("produces same SQL as sqlSelect() with joinMap and dot-notation filterBy", () => {
         const joinMap = { order: Order };

         const command = new SqlSelectCommand(Account, {}, null, joinMap);
         const queryFromCommand = command.build();
         const queryFromFn = sqlSelect(Account, {}, null, joinMap);

         const runtimeParams = {
            filterBy: [{ "order.status": ["=", "paid"] }],
         };

         const commandResult = queryFromCommand.getSql({ params: runtimeParams, options: { dialect: "sqlite" } });
         const fnResult = queryFromFn.getSql({ params: runtimeParams, options: { dialect: "sqlite" } });

         expect(commandResult.text).toBe(fnResult.text);
         expect(commandResult.text).toMatchInlineSnapshot(`
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
           WHERE
             "o_2"."status" = ? /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(commandResult.values).toMatchInlineSnapshot(`
           [
             "paid",
           ]
         `);
      });
   });
});
