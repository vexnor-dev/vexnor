// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test, beforeEach } from "vitest";
import { Account, Order, OrderItem } from "@test-models/vexnor_dev.schema.js";
import { SqlSelectCommand, SqlPreColumnMap } from "#src/core/crud/sql-select-command.js";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { sql } from "#src/core/sql.js";
import { input } from "#src/core/query/sql-input.js";
import { raw } from "#src/core/query/sql-raw.js";
import { row } from "#src/core/query/sql-select-row.js";
import { SqlTable } from "#src/core/schema/sql-table.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";

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

describe("SqlPreColumnMap — uncovered branches", () => {
   beforeEach(() => {
      SqlTable.clearRegistry();
      SqlTable.register(Account);
      SqlTable.register(Order);
      SqlTable.register(OrderItem);
   });

   test("write() returns early when context.params is undefined", () => {
      const preColumnMap = new SqlPreColumnMap(
         Account,
         { order: Order },
         {},
         new Map<string, string>(),
      );
      // Create a context without params
      const context = new SqlBuildContext({ dialect: "sqlite" });
      // Should not throw — just returns early
      preColumnMap.build(context);
      expect(context.columnCount).toBe(0);
   });

   test("write() populates columns from joinArgTables", () => {
      const command = new SqlSelectCommand(
         Account,
         { JOIN: sql`JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}` },
      );
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
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
          "main"."account" AS "a_1" (
            /* <query_1> */
            JOIN "main"."order" AS "o_2" ON "o_2"."account_id" = "a_3"."account_id" /* </query_1> */
          ) AS "query_1"
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* <query_4> */
          /* </query_4> */
          /* </query_0> */"
      `);
   });

   test("write() populates columns from runtime joinBy param (object format)", () => {
      // Use SqlSelectCommand without joinMap but with joinArgTables empty,
      // and pass joinBy at runtime to trigger the runtime path
      const command = new SqlSelectCommand(Account, {});
      const query = command.build();
      const { text } = query.getSql({
         params: {
            // @ts-expect-error — joinBy is only typed for joined queries, testing runtime path
            joinBy: { order: { on: [["_.accountId", "=", "order.accountId"]], type: "inner" } },
         },
         options: { dialect: "sqlite" },
      });
      // The runtime joinBy path will try to resolve tables and populate columns
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
   });

   test("write() skips unresolvable tables in joinBy param", () => {
      const command = new SqlSelectCommand(Account, {});
      const query = command.build();
      // Use a table name that does NOT exist in the registry
      const { text } = query.getSql({
         params: {
            // @ts-expect-error — joinBy is only typed for joined queries, testing runtime path
            joinBy: { nonExistentTable: { on: [["_.accountId", "=", "nonExistentTable.id"]] } },
         },
         options: { dialect: "sqlite" },
      });
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
   });

   test("write() handles joinBy param in array format", () => {
      const command = new SqlSelectCommand(Account, {});
      const query = command.build();
      // Array format: [{ table: "order" }]
      const { text } = query.getSql({
         params: {
            // @ts-expect-error — joinBy is only typed for joined queries, testing runtime path
            joinBy: [{ table: "order" }],
         },
         options: { dialect: "sqlite" },
      });
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
   });

   test("write() throws on joinBy conflict with existing join key from JOIN arg", () => {
      // Create a command WITH a JOIN arg that extracts the Order table
      // but WITHOUT a joinMap — so SqlPreColumnMap.joinMap is undefined/null
      // and the joinKeyRegistry already has "order" from the JOIN arg
      const command = new SqlSelectCommand(
         Account,
         { JOIN: sql`JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}` },
      );
      const query = command.build();
      // Now pass a runtime joinBy that also tries to join "order" — conflict
      expect(() =>
         query.getSql({
            params: {
               // @ts-expect-error — joinBy is only typed for joined queries, testing runtime conflict
               joinBy: { order: { on: [["_.accountId", "=", "order.accountId"]] } },
            },
            options: { dialect: "sqlite" },
         }),
      ).toThrow("conflicts with existing join key");
   });
});

describe("SqlSelectCommand — constructor error paths", () => {
   test("throws when includeMany has entries but no hooks", () => {
      expect(() =>
         new SqlSelectCommand(Account, {
            includeMany: { orders: sql`select 1` },
         }),
      ).toThrow("includeMany");
   });

   test("throws when includeOne has entries but no hooks", () => {
      expect(() =>
         new SqlSelectCommand(Account, {
            includeOne: { lastOrder: sql`select 1` },
         }),
      ).toThrow("includeOne");
   });

   test("throws when JOIN clause is missing join keyword", () => {
      expect(() =>
         new SqlSelectCommand(Account, {
            JOIN: sql`${Account.$accountId} = 1`,
         }),
      ).toThrow("'JOIN' criteria not including SQL keyword 'join'");
   });

   test("throws when JOIN table conflicts with joinMap", () => {
      expect(() =>
         new SqlSelectCommand(
            Account,
            { JOIN: sql`JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}` },
            null,
            { order: Order },
         ),
      ).toThrow("conflicts with existing join key");
   });
});

describe("SqlSelectCommand.build() — hooks and includes", () => {
   test("build with hooks.afterSelect/afterFrom renders includes", () => {
      const afterSelectSql = raw("'included' AS \"myInclude\"");
      const afterFromSql = raw("LEFT JOIN \"other\" ON TRUE");
      const hooks = {
         afterSelect: [afterSelectSql],
         afterFrom: [afterFromSql],
      };
      const command = new SqlSelectCommand(Account, {}, null, undefined, undefined, hooks);
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
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
          'included' AS "myInclude"
        FROM
          "main"."account" AS "a_1"
          LEFT JOIN "other" ON TRUE
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("build with hooks.pagination overrides default pagination", () => {
      const customPagination = raw("FETCH FIRST 10 ROWS ONLY");
      const hooks = { pagination: customPagination };
      const command = new SqlSelectCommand(Account, {}, null, undefined, undefined, hooks);
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
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
          /* </query_3> */ FETCH FIRST 10 ROWS ONLY
          /* </query_0> */"
      `);
   });
});

describe("SqlSelectCommand.build() — SELECT/GROUP_BY/HAVING/ORDER_BY args", () => {
   test("build with user-provided SELECT arg overrides default projection", () => {
      const command = new SqlSelectCommand(Account, {
         SELECT: sql`${row(Account.$accountId, Account.$email)}`,
      });
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          /* <query_1> */ "a_1"."account_id" AS "accountId",
          "a_1"."email" /* </query_1> */
        FROM
          "main"."account" AS "a_1"
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* <query_4> */
          /* </query_4> */
          /* </query_0> */"
      `);
   });

   test("build with GROUP_BY arg", () => {
      const command = new SqlSelectCommand(Account, {
         GROUP_BY: sql`${Account.$status}`,
      });
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
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
        GROUP BY
          /* <query_3> */ "a_1"."status" /* </query_3> */ /* </query_2> */
          /* <query_4> */
          /* </query_4> */
          /* </query_0> */"
      `);
   });

   test("build with HAVING arg", () => {
      const command = new SqlSelectCommand(Account, {
         GROUP_BY: sql`${Account.$status}`,
         HAVING: sql`count(*) > 1`,
      });
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
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
        GROUP BY
          /* <query_3> */ "a_1"."status" /* </query_3> */ /* </query_2> */
          /* <query_4> */
        HAVING
          /* <query_5> */ count(*) > 1 /* </query_5> */ /* </query_4> */
          /* </query_0> */"
      `);
   });

   test("build with ORDER_BY arg", () => {
      const command = new SqlSelectCommand(Account, {
         ORDER_BY: sql`${Account.$createdAt} DESC`,
      });
      const query = command.build();
      const { text } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
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
          /* <query_4> */
        ORDER BY
          /* <query_5> */ "a_1"."created_at" DESC /* </query_5> */ /* </query_4> */
          /* </query_0> */"
      `);
   });
});

describe("SqlSelectCommand — createJoinByNode with joinMap", () => {
   test("creates join node when joinMap has entries", () => {
      const joinMap = { order: Order };
      const joinTypes = { order: "inner" };
      const command = new SqlSelectCommand(Account, {}, null, joinMap, joinTypes);
      const query = command.build();
      const { text } = query.getSql({
         params: {
            joinBy: { order: { on: [["_.accountId", "=", "order.accountId"]], type: "inner" } },
         },
         options: { dialect: "sqlite" },
      });
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
          JOIN "main"."order" AS "o_2" ON "a_1"."account_id" = "o_2"."account_id"
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