import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { info } from "#/core/charms/sql-query-info.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { AccountStatusUdt } from "@test-models/vexnor_dev-enums.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { newSqlTable } from "#/core/schema/sql-table.js";

describe("SqlQuery tests", () => {
   test("SqlQuery row type inference", () => {
      const query = sql`select ${row(Account.$accountId, Account.$status, Account.$email)} from ${Account}`;
      expect(query.row).toBeDefined();
      expect(query.row).toMatchObject({
         $accountId: {
            type: "SqlQueryColumn",
            key: "accountId",
            query: {
               id: "SqlQuery#1",
            },
            target: {
               type: "SqlTableColumn",
               key: "accountId",
            },
         },
         $status: {
            type: "SqlQueryColumn",
            key: "status",
            query: {
               id: "SqlQuery#1",
            },
            target: {
               type: "SqlTableColumn",
               key: "status",
            },
         },
         $email: {
            type: "SqlQueryColumn",
            key: "email",
            query: {
               id: "SqlQuery#1",
            },
            target: {
               type: "SqlTableColumn",
               key: "email",
            },
         },
      });
      expect(Object.keys(query.row)).toMatchObject(["$accountId", "$status", "$email"]);
      expect(query.$accountId).toBeDefined();
      expect(query.$status).toBeDefined();
      expect(query.$email).toBeDefined();
      expect(Reflect.ownKeys(query)).toMatchInlineSnapshot(`
        [
          "id",
          "type",
          "tag",
          "hashIdLazy",
          "rawStrings",
          "rawValues",
          "location",
          "_authorization",
          "_innerQueriesLazy",
          "_dialectsLazy",
          "_paramsLazy",
          "_rowLazy",
          "_$$Lazy",
          "_labelLazy",
          "_infoLazy",
          "_outLazy",
          "_hashLazy",
          "_jsonSchemaLazy",
          "$accountId",
          "$status",
          "$email",
        ]
      `);
      expect(query.$$).toBeDefined();
   });

   test("join sub-query with default queryName", () => {
      const subQuery = sql`
            select ${row(Account.$accountId, Account.$status, Account.$email)}
            from ${Account}
            where ${Account.$status} = ${AccountStatusUdt.CREATED}
         `;

      const query = sql`join ${subQuery}`;

      const context = new SqlBuildContext({ query });
      query.build(context);
      expect(context.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        JOIN (
          /* <query_1> */
          SELECT
            "a_1"."account_id" AS "accountId",
            "a_1"."status",
            "a_1"."email"
          FROM
            "main"."account" AS "a_1"
          WHERE
            "a_1"."status" = ?
            /* </query_1> */
        ) AS "query_1" /* </query_0> */"
      `);
   });

   test("join sub-query with defined queryName", () => {
      const subQuery = sql`
         ${info({ label: "AccountsCreated" })}
            select ${row(Account.$accountId, Account.$status, Account.$email)}
            from ${Account}
            where ${Account.$status} = ${AccountStatusUdt.CREATED}
         `;
      const rootQuery = sql`join ${subQuery}`;

      const context = new SqlBuildContext();
      rootQuery.build(context);
      expect(context.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        JOIN (
          /* <AccountsCreated> */
          /* label: AccountsCreated */
          SELECT
            "a_1"."account_id" AS "accountId",
            "a_1"."status",
            "a_1"."email"
          FROM
            "main"."account" AS "a_1"
          WHERE
            "a_1"."status" = ?
            /* </AccountsCreated> */
        ) AS "AccountsCreated" /* </query_0> */"
      `);
   });

   test("sql query formatting", () => {
      const query = sql`
            select ${row(Account.$accountId, Account.$status, Account.$email)}
            from ${Account}
         `;
      expect(query.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email"
        FROM
          "main"."account" AS "a_1"
          /* </query_0> */"
      `);
   });
});

describe("SqlQuery.dialects", () => {
   const pgTable = newSqlTable<{ Select: { id: string } }>({
      dialect: "postgresql",
      tableInfo: { name: "pg_table", schema: "public" },
      pk: ["id"],
      columns: { id: "id" },
      crud: { select: true, insert: false, update: false, delete: false },
   });

   const mssqlTable = newSqlTable<{ Select: { id: string } }>({
      dialect: "transactsql",
      tableInfo: { name: "mssql_table", schema: "dbo" },
      pk: ["id"],
      columns: { id: "id" },
      crud: { select: true, insert: false, update: false, delete: false },
   });

   test("single table reference", () => {
      const query = sql`SELECT ${row(pgTable.$$)} FROM ${pgTable}`;
      expect(query.dialects).toEqual(new Set(["postgresql"]));
   });

   test("dialect flows through row() columns", () => {
      // row() cols hold a query reference — dialect must be collected through them
      const query = sql`SELECT ${row(pgTable.$id)} FROM ${pgTable}`;
      expect(query.dialects).toEqual(new Set(["postgresql"]));
   });

   test("dialect collected from subquery", () => {
      const sub = sql`SELECT ${row(pgTable.$$)} FROM ${pgTable}`;
      const query = sql`SELECT ${row(sub.$$)} FROM (${sub}) s`;
      expect(query.dialects).toEqual(new Set(["postgresql"]));
   });

   test("dialect collected across multiple tables with same dialect", () => {
      const query = sql`
         SELECT ${row(Account.$accountId, Order.$orderId)}
         FROM ${Account}
         JOIN ${Order} ON true
      `;
      // both Account and Order default to "sql" — single dialect
      expect(query.dialects.size).toBe(1);
   });

   test("cross-dialect via row() columns from different dialect tables", () => {
      const query = sql`SELECT ${row(pgTable.$id, mssqlTable.$id)} FROM ${pgTable}, ${mssqlTable}`;
      expect(query.dialects).toEqual(new Set(["postgresql", "transactsql"]));
   });

   test("no table reference → empty dialects", () => {
      const query = sql`SELECT 1`;
      expect(query.dialects.size).toBe(0);
   });

   test("getSql uses table dialect for sql-formatter", () => {
      const query = sql`SELECT ${row(pgTable.$$)} FROM ${pgTable}`;
      // should not throw — postgresql is a valid sql-formatter language
      expect(() => query.getSql({})).not.toThrow();
      expect(query.getSql({}).text).toContain("pg_table");
   });
});
