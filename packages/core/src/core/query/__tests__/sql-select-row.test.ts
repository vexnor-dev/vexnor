import { assertType, describe, expect, test } from "vitest";
import { InferResultRowFromColumns, row, SqlSelectRow } from "#src/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { sql } from "#src/core/sql.js";
import { param } from "#src/core/query/sql-param.js";
import { AccountStatusUdt } from "@test-models/vexnor_dev-enums.js";
import { newSqlQueryColumn, SqlQueryColumn } from "#src/core/query/sql-query-column.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { InferSelectRowByResult } from "#src/core/query/sql-query-types.js";
import { IAccountSelect } from "#src/test/testing.js";
import { SqlQuery } from "#src/core/query/sql-query.js";
import { newSqlTableColumn, SqlTableColumn } from "#src/core/schema/sql-table-column.js";
import { SqlTableIdentity } from "#src/core/schema/sql-table-identity.js";

describe("SqlSelectRow tests", () => {
   test("infer result row from select row", () => {
      type ResultRow = InferResultRowFromColumns<[typeof Account.$accountId, typeof Order.$orderId]>;
      assertType<ResultRow>({
         accountId: "",
         orderId: "",
      });
   });

   test("SqlSelectRow type inference from columns", () => {
      const tableInfo: SqlTableIdentity = { name: "account", schema: "vexnor_dev", out: false, alias: null };
      const query = sql``;
      type Row = InferSelectRowByResult<
         InferResultRowFromColumns<[typeof Account.$accountId, typeof Account.$status, typeof Account.$createdAt]>
      >;
      const row: Row = {
         $accountId: newSqlQueryColumn({
            key: "accountId",
            query: query,
            target: newSqlTableColumn<{ Key: "accountId"; Type: string }>({
               key: "accountId",
               columnName: "account_id",
               tableInfo,
            }),
         }),
         $createdAt: newSqlQueryColumn({
            key: "createdAt",
            query: query,
            target: newSqlTableColumn<{ Key: "createdAt"; Type: Date }>({
               key: "createdAt",
               columnName: "created_at",
               tableInfo,
            }),
         }),
         $status: newSqlQueryColumn({
            key: "status",
            query: query,
            target: newSqlTableColumn<{ Key: "status"; Type: AccountStatusUdt }>({
               key: "status",
               columnName: "status",
               tableInfo,
            }),
         }),
      };
      expect(row).toBeDefined();
   });

   test("SqlSelectRow type inference from $$ + column", () => {
      const tableInfo: SqlTableIdentity = { name: "account", schema: "vexnor_dev", out: false, alias: null };
      type Row = InferSelectRowByResult<InferResultRowFromColumns<[typeof Account.$$, typeof Order.$orderId]>>;
      const query = sql``;
      const row: Row = {
         $accountId: newSqlQueryColumn({
            key: "accountId",
            query: query,
            target: newSqlTableColumn<{ Key: "accountId"; Type: string }>({
               key: "accountId",
               columnName: "account_id",
               tableInfo,
            }),
         }),
         $createdAt: newSqlQueryColumn({
            key: "createdAt",
            query: query,
            target: newSqlTableColumn<{ Key: "createdAt"; Type: Date }>({
               key: "createdAt",
               columnName: "created_at",
               tableInfo,
            }),
         }),
         $email: newSqlQueryColumn({
            key: "email",
            query: query,
            target: newSqlTableColumn<{ Key: "email"; Type: string }>({
               key: "email",
               columnName: "email",
               tableInfo,
            }),
         }),
         $firstName: newSqlQueryColumn({
            key: "firstName",
            query: query,
            target: newSqlTableColumn<{ Key: "firstName"; Type: string }>({
               key: "firstName",
               columnName: "first_name",
               tableInfo,
            }),
         }),
         $lastName: newSqlQueryColumn({
            key: "lastName",
            query: query,
            target: newSqlTableColumn<{ Key: "lastName"; Type: string }>({
               key: "lastName",
               columnName: "last_name",
               tableInfo,
            }),
         }),
         $notes: newSqlQueryColumn({
            key: "notes",
            query: query,
            target: newSqlTableColumn<{ Key: "notes"; Type: string }>({
               key: "notes",
               columnName: "notes",
               tableInfo,
            }),
         }),
         $status: newSqlQueryColumn({
            key: "status",
            query: query,
            target: newSqlTableColumn<{ Key: "status"; Type: AccountStatusUdt }>({
               key: "status",
               columnName: "status",
               tableInfo,
            }),
         }),
         $parentId: newSqlQueryColumn({
            key: "parentId",
            query: query,
            target: newSqlTableColumn<{ Key: "parentId"; Type: string }>({
               key: "parentId",
               columnName: "parent_id",
               tableInfo,
            }),
         }),
         $modifiedAt: newSqlQueryColumn({
            key: "modifiedAt",
            query: query,
            target: newSqlTableColumn<{ Key: "modifiedAt"; Type: Date }>({
               key: "modifiedAt",
               columnName: "modified_at",
               tableInfo,
            }),
         }),
         $orderId: newSqlQueryColumn({
            key: "orderId",
            query: query,
            target: newSqlTableColumn<{ Key: "orderId"; Type: string }>({
               key: "orderId",
               columnName: "order_id",
               tableInfo,
            }),
         }),
      };

      expect(row).toBeDefined();
   });

   test("row(...columns) should match expected type", () => {
      const target = row(Account.$accountId, Account.$firstName, Account.$lastName.as("name"));
      assertType<SqlSelectRow<{ Row: { accountId: string; firstName: string; name: string } }>>(target);
      const actual = target.getRow({ query: sql`` });
      expect(actual.$accountId).toBeDefined();
      expect(actual.$firstName).toBeDefined();
      expect(actual.$name).toBeDefined();
   });

   test("row(...columns) column should be defined", () => {
      const target = row(Account.$accountId, Account.$firstName, Account.$lastName);
      assertType<SqlSelectRow<{ Row: { accountId: string; firstName: string; lastName: string } }>>(target);
      const actual = target.getRow({ query: sql`` });
      expect(actual.$accountId).toBeDefined();
      expect(actual.$firstName).toBeDefined();
      expect(actual.$lastName).toBeDefined();
   });

   test("row($$) column should be defined", () => {
      const target = row(Account.$$);
      const actual = target.getRow({ query: sql`` });
      expect(actual.$accountId).toBeDefined();
      expect(actual.$firstName).toBeDefined();
      expect(actual.$lastName).toBeDefined();
   });

   test("$build with distinct columns", () => {
      const target = row(Account.$accountId, Account.$firstName, Account.$lastName);
      assertType<SqlSelectRow<{ Row: { accountId: string; firstName: string; lastName: string } }>>(target);
      const context = new SqlBuildContext();
      context.next("select");
      target.build(context);

      expect(context.text).toMatchInlineSnapshot(`
        ""a_1"."account_id" AS "accountId",
        "a_1"."first_name" AS "firstName",
        "a_1"."last_name" AS "lastName""
      `);
   });

   test("$build with aliased column", () => {
      const target = row(Account.$accountId, Account.$firstName, Account.$lastName.as("name"));
      assertType<SqlSelectRow<{ Row: { accountId: string; firstName: string; name: string } }>>(target);
      const context = new SqlBuildContext();
      context.next("select");
      target.getRow({ query: sql`` });
      target.build(context);

      expect(context.text).toMatchInlineSnapshot(`
        ""a_1"."account_id" AS "accountId",
        "a_1"."first_name" AS "firstName",
        "a_1"."last_name" AS "name""
      `);
   });

   test("$build with aliased table and column", () => {
      const target = row(
         Account.as`inserted`.$accountId,
         Account.as`inserted`.$firstName,
         Account.as`inserted`.$lastName.as("name"),
      );
      assertType<SqlSelectRow<{ Row: { accountId: string; firstName: string; name: string } }>>(target);
      const context = new SqlBuildContext();
      context.next("select");
      target.getRow({ query: sql`` });
      target.build(context);

      expect(context.text).toMatchInlineSnapshot(`
        ""inserted"."account_id" AS "accountId",
        "inserted"."first_name" AS "firstName",
        "inserted"."last_name" AS "name""
      `);
   });

   test("$build with table.$$", () => {
      const target = row(Account.$$);
      const context = new SqlBuildContext();
      context.next("select");
      target.getRow({ query: sql`` });
      target.build(context);

      expect(context.text).toMatchInlineSnapshot(`
        ""a_1"."account_id" AS "accountId",
        "a_1"."status",
        "a_1"."email",
        "a_1"."first_name" AS "firstName",
        "a_1"."last_name" AS "lastName",
        "a_1"."notes",
        "a_1"."created_at" AS "createdAt",
        "a_1"."modified_at" AS "modifiedAt",
        "a_1"."parent_id" AS "parentId""
      `);
   });

   test("SqlRow $build with aliased table.$$", () => {
      const target = row(Account.as`inserted`.$$);
      assertType<SqlSelectRow<{ Row: IAccountSelect }>>(target);
      const context = new SqlBuildContext();
      context.next("select");
      target.getRow({ query: sql`` });
      target.build(context);

      expect(context.text).toMatchInlineSnapshot(`
        ""inserted"."account_id" AS "accountId",
        "inserted"."status",
        "inserted"."email",
        "inserted"."first_name" AS "firstName",
        "inserted"."last_name" AS "lastName",
        "inserted"."notes",
        "inserted"."created_at" AS "createdAt",
        "inserted"."modified_at" AS "modifiedAt",
        "inserted"."parent_id" AS "parentId""
      `);
   });

   test("query.row is defined", () => {
      const query = sql`
         select ${row(Account.$accountId, Account.$status, Account.$firstName)}
         from ${Account}
         where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`;
      expect(query.row).toBeDefined();
      expect(query.row).toMatchObject({
         $accountId: {
            type: "SqlQueryColumn",
            key: "accountId",
            format: null,
            target: {
               type: "SqlTableColumn",
               columnName: "account_id",
               key: "accountId",
               tableInfo: {
                  name: "account",
                  schema: "main",
               },
            },
         },
         $status: {},
         $firstName: {},
      });
   });

   test("query.row is not defined", () => {
      const query = sql`
         select ${(Account.$accountId, Account.$status, Account.$firstName)}
         from ${Account}
         where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`;
      expect(query.row).toBeFalsy();
      assertType<SqlQuery<{ Row: void; Params: { accountId: string } }>>(query);
   });

   test("query.row.[column] renders column", () => {
      const query = sql`
         select ${row(Account.$accountId, Account.$status, Account.$firstName)}
         from ${Account}`;

      assertType<SqlQuery<{ Row: { accountId: string; status: AccountStatusUdt; firstName: string } }>>(query);
      expect(query.row).toBeDefined();
      expect(query.row.$accountId).toBeDefined();
      expect(query.$accountId).toBeDefined();
      expect(query.row.$accountId).toMatchObject({
         type: "SqlQueryColumn",
         key: "accountId",
         format: null,
         target: {
            columnName: "account_id",
            key: "accountId",
            type: "SqlTableColumn",
            id: "SqlTableColumn#1(account.account_id as accountId)",
            tableInfo: {
               name: "account",
               schema: "main",
            },
         },
         query: {
            id: "SqlQuery#1",
         },
      });

      expect(query.$accountId).toBeInstanceOf(SqlQueryColumn);
      expect(query.$accountId.target).toBeInstanceOf(SqlTableColumn);

      expect(query.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."first_name" AS "firstName"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);

      const context = new SqlBuildContext({ query });
      context.next("where");
      query.$accountId.build(context);
      expect(context.text).toEqual(`"query_0"."accountId"`);
   });
});
