import { describe, expect, test } from "vitest";
import { DuckDBConnection } from "@duckdb/node-api";
import { input, newSqlTable, param, row, sql, SqlBuildContext, SqlLiteralType } from "@vexnor/core";
import { Account, Order } from "@vexnor/core/testing";
import { jsonMany, jsonOne } from "#src/charms/json-aggregation-duckdb.js";
import { DuckDBDeleteCommand } from "#src/crud/duckdb-delete-command.js";
import { DuckDBInsertFromCommand } from "#src/crud/duckdb-insert-from-command.js";
import { DuckDBInsertRowsCommand } from "#src/crud/duckdb-insert-rows-command.js";
import { DuckDBProjectBy } from "#src/crud/duckdb-project-by.js";
import { DuckDBSelectCommand } from "#src/crud/duckdb-select-command.js";
import { newDuckDBTableHandler } from "#src/crud/duckdb-table-handler.js";
import { DuckDBUpdateCommand } from "#src/crud/duckdb-update-command.js";
import { DuckDBUpsertCommand } from "#src/crud/duckdb-upsert-command.js";
import { defaultQueryOptions } from "#src/default-query-options.js";
import "#src/duckdb-augment.js";

const Task = newSqlTable<{
   Name: "task";
   Select: { taskId: string; title: string; isCompleted: boolean; priority: number; createdAt: Date };
   Insert: { taskId?: string; title: string; isCompleted?: boolean; priority?: number; createdAt?: Date };
   Update: { title?: string; isCompleted?: boolean; priority?: number; createdAt?: Date };
   Delete: true;
   Source: "test";
}>({
   crud: { select: true, insert: true, update: true, delete: true },
   tableInfo: { name: "task", schema: "main", alias: null, out: false },
   pk: ["taskId"],
   source: "test",
   columns: {
      taskId: "task_id",
      title: "title",
      isCompleted: "is_completed",
      priority: "priority",
      createdAt: "created_at",
   },
   dbSchema: {
      taskId: { dbType: "uuid", type: SqlLiteralType.String },
      title: { dbType: "varchar", type: SqlLiteralType.String },
      isCompleted: { dbType: "boolean", type: SqlLiteralType.Boolean },
      priority: { dbType: "integer", type: SqlLiteralType.Number },
      createdAt: { dbType: "timestamp", type: SqlLiteralType.Date },
   },
});

describe("DuckDB CRUD SQL generation", () => {
   test("builds every table-handler command with DuckDB metadata", () => {
      const handler = newDuckDBTableHandler(Account);
      const params = input<{ id: string }>();
      const queries = [
         handler.select({ WHERE: sql`${Account.$accountId} = ${params.$id}` }),
         handler.insertRows(),
         handler.insertFrom({ FROM: sql`select ${row(Account.$$)} from ${Account}` }),
         handler.update({ WHERE: sql`${Account.$accountId} = ${params.$id}` }),
         handler.delete({ WHERE: sql`${Account.$accountId} = ${params.$id}` }),
         handler.upsert({ CONFLICT_ON: [Account.$accountId] }),
      ];

      expect(queries.map((query) => query.pluginName)).toMatchInlineSnapshot(`
        [
          "@vexnor/duckdb",
          "@vexnor/duckdb",
          "@vexnor/duckdb",
          "@vexnor/duckdb",
          "@vexnor/duckdb",
          "@vexnor/duckdb",
        ]
      `);
   });

   test("omits methods for disabled CRUD capabilities", () => {
      const readOnly = { ...Account, crud: { select: true, insert: false, update: false, delete: false } };
      const writeOnly = { ...Account, crud: { select: false, insert: true, update: true, delete: true } };
      const readOnlyHandler = Reflect.apply(newDuckDBTableHandler, undefined, [readOnly]);
      const writeOnlyHandler = Reflect.apply(newDuckDBTableHandler, undefined, [writeOnly]);

      expect({
         readOnly: Object.keys(readOnlyHandler).sort(),
         writeOnly: Object.keys(writeOnlyHandler).sort(),
      }).toMatchInlineSnapshot(`
        {
          "readOnly": [
            "select",
          ],
          "writeOnly": [
            "delete",
            "insertFrom",
            "insertRows",
            "update",
            "upsert",
          ],
        }
      `);
   });

   test("generates insert, update, delete, insert-from, and upsert SQL", () => {
      const id = param<{ id: string }>("id");
      const cases = [
         new DuckDBInsertRowsCommand(Account).execute().source.getSql({
            params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "A", lastName: "B" }] },
            options: defaultQueryOptions,
         }),
         new DuckDBUpdateCommand(Account, { WHERE: sql`${Account.$accountId} = ${id}` }).execute().source.getSql({
            params: { id: "id-1", set: { email: "updated@b.com" } },
            options: defaultQueryOptions,
         }),
         new DuckDBDeleteCommand(Account, { WHERE: sql`${Account.$accountId} = ${id}` }).execute().source.getSql({
            params: { id: "id-1" },
            options: defaultQueryOptions,
         }),
         new DuckDBInsertFromCommand(Account, {
            FROM: sql`select ${row(Account.$$)} from ${Account}`,
         }).execute().source.getSql({ options: defaultQueryOptions }),
         new DuckDBUpsertCommand(Account, { CONFLICT_ON: [Account.$accountId] }).execute().source.getSql({
            params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "A", lastName: "B" }] },
            options: defaultQueryOptions,
         }),
      ];

      expect(cases).toMatchInlineSnapshot(`
        [
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        INSERT INTO
          "main"."account" ("account_id", "email", "first_name", "last_name")
        VALUES
          ($1, $2, $3, $4)
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */",
            "values": [
              "id-1",
              "a@b.com",
              "A",
              "B",
            ],
          },
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        UPDATE "main"."account"
        SET
          "email" = $1
          /* <query_1> */
        WHERE
          /* <query_2> */
          "account"."account_id" = $2 /* </query_2> */ /* </query_1> */
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */",
            "values": [
              "updated@b.com",
              "id-1",
            ],
          },
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        DELETE FROM "main"."account"
        /* <query_1> */
        WHERE
          /* <query_2> */ "account"."account_id" = $1 /* </query_2> */ /* </query_1> */
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */",
            "values": [
              "id-1",
            ],
          },
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        INSERT INTO
          "main"."account"
          /* <query_1> */
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
          "main"."account" AS "a_1" /* </query_1> */
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */",
            "values": [],
          },
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        INSERT INTO
          "main"."account" ("account_id", "email", "first_name", "last_name")
        VALUES
          ($1, $2, $3, $4)
        ON CONFLICT ("account_id") DO
        UPDATE
        SET
          "email" = excluded."email",
          "first_name" = excluded."first_name",
          "last_name" = excluded."last_name"
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */",
            "values": [
              "id-1",
              "a@b.com",
              "A",
              "B",
            ],
          },
        ]
      `);
   });

   test("requires a delete predicate unless force is explicit", () => {
      // @ts-expect-error — force must be the literal true
      expect(() => new DuckDBDeleteCommand(Account, { force: false }).execute()).toThrow("WHERE condition or force required");
      expect(new DuckDBDeleteCommand(Account, { force: true }).execute().source.getSql({ options: defaultQueryOptions }))
         .toMatchInlineSnapshot(`
           {
             "text": "/* <query_0> */
           /* driver: duckdb */
           DELETE FROM "main"."account"
           RETURNING
             "account"."account_id" AS "accountId",
             "account"."status",
             "account"."email",
             "account"."first_name" AS "firstName",
             "account"."last_name" AS "lastName",
             "account"."notes",
             "account"."created_at" AS "createdAt",
             "account"."modified_at" AS "modifiedAt",
             "account"."parent_id" AS "parentId"
             /* </query_0> */",
             "values": [],
           }
         `);
   });
});

describe("DuckDB projection and includes", () => {
   function build(select: unknown) {
      const query = new DuckDBSelectCommand(Task, {}).build();
      return Reflect.apply(query.getSql, query, [{ params: { select }, options: defaultQueryOptions }]);
   }

   test("supports columns, aliases, aggregates, transforms, and the boolean aggregate cast", () => {
      const cases = [
         build(undefined),
         build({ taskId: true, renamed: "title" }),
         build({ total: { fn: "sum", col: "priority" }, completed: { fn: "avg", col: "isCompleted" }, count: { fn: "count", col: "*" } }),
         build({ period: { fn: "dateTrunc", col: "createdAt", args: "month" } }),
         build({ title: { fn: "coalesce", col: "title", args: ["untitled", "missing"] } }),
         build({ title: { fn: "coalesce", col: "title", args: "untitled" } }),
         build({ rounded: { fn: "round", col: "priority", args: [2] }, absolute: { fn: "abs", col: "priority" } }),
         build({ rounded: { fn: "round", col: "priority" } }),
         build({ label: { fn: "concat", col: "title", args: [" - ", "done"] } }),
         build({ label: { fn: "concat", col: "title", args: "!" } }),
      ];

      expect(cases).toMatchInlineSnapshot(`
        [
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        SELECT
          "t_1"."task_id" AS "taskId",
          "t_1"."title",
          "t_1"."is_completed" AS "isCompleted",
          "t_1"."priority",
          "t_1"."created_at" AS "createdAt"
        FROM
          "main"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */",
            "values": [],
          },
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        SELECT
          "t_1"."task_id" AS "taskId",
          "t_1"."title" AS "renamed"
        FROM
          "main"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */",
            "values": [],
          },
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        SELECT
          sum("t_1"."priority") AS "total",
          avg("t_1"."is_completed"::integer) AS "completed",
          count(*) AS "count"
        FROM
          "main"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */",
            "values": [],
          },
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        SELECT
          date_trunc('month', "t_1"."created_at") AS "period"
        FROM
          "main"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */",
            "values": [],
          },
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        SELECT
          coalesce("t_1"."title", $1, $2) AS "title"
        FROM
          "main"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */",
            "values": [
              "untitled",
              "missing",
            ],
          },
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        SELECT
          coalesce("t_1"."title", $1) AS "title"
        FROM
          "main"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */",
            "values": [
              "untitled",
            ],
          },
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        SELECT
          round("t_1"."priority", 2) AS "rounded",
          abs("t_1"."priority") AS "absolute"
        FROM
          "main"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */",
            "values": [],
          },
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        SELECT
          round("t_1"."priority") AS "rounded"
        FROM
          "main"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */",
            "values": [],
          },
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        SELECT
          "t_1"."title" || $1 || $2 AS "label"
        FROM
          "main"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */",
            "values": [
              " - ",
              "done",
            ],
          },
          {
            "text": "/* <query_0> */
        /* driver: duckdb */
        SELECT
          "t_1"."title" || $1 AS "label"
        FROM
          "main"."task" AS "t_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */",
            "values": [
              "!",
            ],
          },
        ]
      `);
   });

   test("rejects every invalid projection branch", () => {
      const errors: string[] = [];
      const invalid = [
         { bad: false },
         { bad: { fn: "unsupported", col: "title" } },
         { bad: { fn: "dateTrunc", col: "createdAt", args: "week" } },
         { bad: { fn: "round", col: "priority", args: Number.NaN } },
         { bad: { fn: "sum", col: "missing" } },
      ];
      for (const select of invalid) {
         try {
            build(select);
         } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
         }
      }
      expect(errors).toMatchInlineSnapshot(`
        [
          "Error building 'SqlQuery#70(driver=duckdb)' in query '-'\\nError building 'DuckDBProjectBy#12(task.select)' in query 'SqlQuery#70(driver=duckdb)'\\nInvalid select entry for alias 'bad': false",
          "Error building 'SqlQuery#74(driver=duckdb)' in query '-'\\nError building 'DuckDBProjectBy#13(task.select)' in query 'SqlQuery#74(driver=duckdb)'\\nUnsupported transform: unsupported",
          "Error building 'SqlQuery#78(driver=duckdb)' in query '-'\\nError building 'DuckDBProjectBy#14(task.select)' in query 'SqlQuery#78(driver=duckdb)'\\nInvalid dateTrunc granularity: "week". Allowed: year, month, day, hour",
          "Error building 'SqlQuery#82(driver=duckdb)' in query '-'\\nError building 'DuckDBProjectBy#15(task.select)' in query 'SqlQuery#82(driver=duckdb)'\\nInvalid round precision: "NaN". Must be a finite number.",
          "Error building 'SqlQuery#86(driver=duckdb)' in query '-'\\nError building 'DuckDBProjectBy#16(task.select)' in query 'SqlQuery#86(driver=duckdb)'\\nColumn not found: missing",
        ]
      `);
   });

   test("resolves joined projection columns and nested runtime parameters", () => {
      const qualifiedContext = new SqlBuildContext({
         params: { select: { projected: "joined.external" } },
      });
      qualifiedContext.addColumns({ "joined.external": Task.$title });
      qualifiedContext.setAlias(Task.tableInfo, { alias: "t_1" });
      new DuckDBProjectBy(Task, "select").write(qualifiedContext);

      const shortContext = new SqlBuildContext({
         params: { select: { projected: "joined.external" } },
      });
      shortContext.addColumns({ external: Task.$title });
      shortContext.setAlias(Task.tableInfo, { alias: "t_1" });
      new DuckDBProjectBy(Task, "select").write(shortContext);

      const nestedContext = new SqlBuildContext({ params: { runtime: null } });
      nestedContext.setAlias(Task.tableInfo, { alias: "t_1" });
      new DuckDBProjectBy(Task, "runtime.select").write(nestedContext);

      expect({
         qualified: qualifiedContext.text,
         short: shortContext.text,
         nested: nestedContext.text,
      }).toMatchInlineSnapshot(`
        {
          "nested": ""t_1"."task_id",
        "t_1"."title",
        "t_1"."is_completed",
        "t_1"."priority",
        "t_1"."created_at"",
          "qualified": ""t_1"."title" AS "projected"",
          "short": ""t_1"."title" AS "projected"",
        }
      `);
   });

   test("builds one and many JSON includes and rejects invalid charm contexts", () => {
      const orders = sql`select ${row(Order.$$)} from ${Order}`;
      const select = new DuckDBSelectCommand(Account, {
         includeOne: { firstOrder: orders },
         includeMany: { orders },
      }).build().getSql({ params: {}, options: defaultQueryOptions });
      const noRow = sql`select 1`;
      const missingRow = jsonMany(noRow);
      const selectContext = new SqlBuildContext();
      selectContext.next("select");
      const whereContext = new SqlBuildContext();
      whereContext.next("where");
      const directContext = new SqlBuildContext();
      directContext.next("select");

      expect(select).toMatchInlineSnapshot(`
        {
          "text": "/* <query_0> */
        /* driver: duckdb */
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
          /* <query_3> */ (
            SELECT
              to_json("query_1")
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
                      "main"."order" AS "o_2" /* </query_2> */
                  ) AS "query_2"
                LIMIT
                  1 /* </query_1> */
              ) AS "query_1"
            LIMIT
              1
          ) /* </query_3> */ /* <query_4> */ AS "firstOrder" /* </query_4> */,
          /* <query_5> */ (
            SELECT
              coalesce(json_group_array("query_2"), '[]')
            FROM
              (
                /* <query_2> */
                SELECT
                  "o_3"."order_id" AS "orderId",
                  "o_3"."status",
                  "o_3"."created_at" AS "createdAt",
                  "o_3"."modified_at" AS "modifiedAt",
                  "o_3"."account_id" AS "accountId"
                FROM
                  "main"."order" AS "o_3" /* </query_2> */
              ) AS "query_2"
          ) /* </query_5> */ /* <query_6> */ AS "orders" /* </query_6> */
        FROM
          "main"."account" AS "a_1"
          /* <query_7> */
          /* </query_7> */
          /* <query_8> */
          /* </query_8> */
          /* <query_9> */
          /* </query_9> */
          /* </query_0> */",
          "values": [],
        }
      `);
      expect(() => jsonOne(noRow)).toThrow("query.$$");
      expect(() => missingRow.build(selectContext, defaultQueryOptions)).toThrow("query row is required");
      expect(() => jsonMany(orders).build(whereContext, defaultQueryOptions)).toThrow("Cannot use");
      jsonMany(orders).build(directContext, defaultQueryOptions);
      const nullableOptionsContext = new SqlBuildContext();
      nullableOptionsContext.next("select");
      const selectCharm = jsonMany(orders).as("orders");
      Reflect.apply(Reflect.get(selectCharm, "write"), selectCharm, [nullableOptionsContext, null]);
      expect(directContext.text).toMatchInlineSnapshot(`
        "/* <query_1> */ (
          SELECT
            coalesce(json_group_array ("query_0"), '[]')
          FROM
            (
              /* <query_0> */
              SELECT
                "o_1"."order_id" AS "orderId",
                "o_1"."status",
                "o_1"."created_at" AS "createdAt",
                "o_1"."modified_at" AS "modifiedAt",
                "o_1"."account_id" AS "accountId"
              FROM
                "main"."order" AS "o_1" /* </query_0> */
            ) AS "query_0"
        ) /* </query_1> */"
      `);
      expect(nullableOptionsContext.text).toMatchInlineSnapshot(`
        "/* <query_1> */ (
          SELECT
            coalesce(json_group_array ("query_0"), '[]')
          FROM
            (
              /* <query_0> */
              SELECT
                "o_1"."order_id" AS "orderId",
                "o_1"."status",
                "o_1"."created_at" AS "createdAt",
                "o_1"."modified_at" AS "modifiedAt",
                "o_1"."account_id" AS "accountId"
              FROM
                "main"."order" AS "o_1" /* </query_0> */
            ) AS "query_0"
        ) /* </query_1> */ /* <query_2> */ AS "orders" /* </query_2> */"
      `);
      expect(jsonMany(orders).type).toMatchInlineSnapshot(`"many"`);
   });
});

describe("DuckDB CRUD execution", () => {
   test("executes insert, select, update, upsert, and delete against DuckDB", async () => {
      const db = await DuckDBConnection.create();
      try {
         await db.run(`
            create type account_status as enum ('created', 'confirmed', 'deleted');
            create table account (
               account_id uuid primary key,
               status account_status not null default 'created',
               email varchar not null,
               first_name varchar not null,
               last_name varchar not null,
               notes varchar,
               created_at timestamp with time zone not null default current_timestamp,
               modified_at timestamp with time zone not null default current_timestamp,
               parent_id uuid references account(account_id)
            )
         `);
         const accountId = "00000000-0000-4000-8000-000000000001";
         const inserted = await Account.duckdb.insertRows().one({
            db,
            params: { rows: [{ accountId, email: "duck@example.com", firstName: "Duck", lastName: "DB" }] },
         });
         const selectQuery = Account.duckdb.select({});
         const selectOptions = selectQuery.getOptions({
            db,
            params: { filterBy: { accountId }, select: { accountId: true, email: true } },
         });
         const selected = await selectQuery.one({
            db,
            params: { filterBy: { accountId }, select: { accountId: true, email: true } },
         });
         const updated = await Account.duckdb.update({
            WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
         }).one({ db, params: { accountId, set: { email: "updated@example.com" } } });
         const upserted = await Account.duckdb.upsert({ CONFLICT_ON: [Account.$accountId] }).one({
            db,
            params: { rows: [{ accountId, email: "upserted@example.com", firstName: "Duck", lastName: "DB" }] },
         });
         const deleted = await Account.duckdb.delete({
            WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
         }).one({ db, params: { accountId } });

         expect(selectOptions).toMatchInlineSnapshot(`
           {
             "text": "/* <query_0> */
           /* driver: duckdb */
           SELECT
             "a_1"."account_id" AS "accountId",
             "a_1"."email"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
           WHERE
             "a_1"."account_id" = $1 /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */",
             "values": [
               "00000000-0000-4000-8000-000000000001",
             ],
           }
         `);
         expect(selected.accountId).toBe(accountId);
         const { createdAt: insertedCreatedAt, modifiedAt: insertedModifiedAt, ...insertedStable } = inserted;
         const { createdAt: updatedCreatedAt, modifiedAt: updatedModifiedAt, ...updatedStable } = updated;
         const { createdAt: upsertedCreatedAt, modifiedAt: upsertedModifiedAt, ...upsertedStable } = upserted;
         const { createdAt: deletedCreatedAt, modifiedAt: deletedModifiedAt, ...deletedStable } = deleted;
         expect([insertedCreatedAt, insertedModifiedAt, updatedCreatedAt, updatedModifiedAt,
            upsertedCreatedAt, upsertedModifiedAt, deletedCreatedAt, deletedModifiedAt]
         ).toSatisfy((values: Date[]) => values.every((value) => value instanceof Date));
         expect({ inserted: insertedStable, selected, updated: updatedStable, upserted: upsertedStable, deleted: deletedStable }).toMatchInlineSnapshot(`
           {
             "deleted": {
               "accountId": "00000000-0000-4000-8000-000000000001",
               "email": "upserted@example.com",
               "firstName": "Duck",
               "lastName": "DB",
               "notes": null,
               "parentId": null,
               "status": "created",
             },
             "inserted": {
               "accountId": "00000000-0000-4000-8000-000000000001",
               "email": "duck@example.com",
               "firstName": "Duck",
               "lastName": "DB",
               "notes": null,
               "parentId": null,
               "status": "created",
             },
             "selected": {
               "accountId": "00000000-0000-4000-8000-000000000001",
               "email": "duck@example.com",
             },
             "updated": {
               "accountId": "00000000-0000-4000-8000-000000000001",
               "email": "updated@example.com",
               "firstName": "Duck",
               "lastName": "DB",
               "notes": null,
               "parentId": null,
               "status": "created",
             },
             "upserted": {
               "accountId": "00000000-0000-4000-8000-000000000001",
               "email": "upserted@example.com",
               "firstName": "Duck",
               "lastName": "DB",
               "notes": null,
               "parentId": null,
               "status": "created",
             },
           }
         `);
      } finally {
         db.closeSync();
      }
   });
});
