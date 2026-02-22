import { assertType, describe, expect, test } from "vitest";
import { InferResultRowFromColumns, row, SqlSelectRow } from "../sql-select-row.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { SqlBuildContext } from "../sql-build-context.js";
import { sql } from "../../sql.js";
import { param } from "../sql-param.js";
import { AccountStatusUdt } from "@test-models/valnor_test-enums.js";
import { newSqlSelectColumn, SqlSelectColumn } from "../sql-select-column.js";
import { Order } from "@test-models/valnor_test.order-table.js";
import { InferSelectRowByResult } from "../sql-query-types.js";
import { IAccountSelect } from "../../../testing/index.js";
import { SqlQuery } from "../sql-query.js";
import { newSqlTableColumn, SqlTableColumn } from "../../schema/index.js";

describe("SqlSelectRow tests", () => {
   test("infer result row from select row", () => {
      type ResultRow = InferResultRowFromColumns<[typeof Account.$accountId, typeof Order.$orderId]>;
      assertType<ResultRow>({
         accountId: "",
         orderId: "",
      });
   });

   test("SqlSelectRow type inference from columns", () => {
      const tableInfo = { name: "account", schema: "valnor_test" };
      const query = sql``;
      type Row = InferSelectRowByResult<
         InferResultRowFromColumns<[typeof Account.$accountId, typeof Account.$status, typeof Account.$createdAt]>
      >;
      const row: Row = {
         $accountId: newSqlSelectColumn({
            key: "accountId",
            query,
            target: newSqlTableColumn<{ Key: "accountId"; Type: string }>({
               key: "accountId",
               columnName: "account_id",
               tableInfo,
            }),
         }),
         $createdAt: newSqlSelectColumn({
            key: "createdAt",
            query,
            target: newSqlTableColumn<{ Key: "createdAt"; Type: Date }>({
               key: "createdAt",
               columnName: "created_at",
               tableInfo,
            }),
         }),
         $status: newSqlSelectColumn({
            key: "status",
            query,
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
      const tableInfo = { name: "account", schema: "valnor_test" };
      type Row = InferSelectRowByResult<InferResultRowFromColumns<[typeof Account.$$, typeof Order.$orderId]>>;
      const query = sql``;
      const row: Row = {
         $accountId: newSqlSelectColumn({
            key: "accountId",
            query,
            target: newSqlTableColumn<{ Key: "accountId"; Type: string }>({
               key: "accountId",
               columnName: "account_id",
               tableInfo,
            }),
         }),
         $createdAt: newSqlSelectColumn({
            key: "createdAt",
            query,
            target: newSqlTableColumn<{ Key: "createdAt"; Type: Date }>({
               key: "createdAt",
               columnName: "created_at",
               tableInfo,
            }),
         }),
         $email: newSqlSelectColumn({
            key: "email",
            query,
            target: newSqlTableColumn<{ Key: "email"; Type: string }>({
               key: "email",
               columnName: "email",
               tableInfo,
            }),
         }),
         $firstName: newSqlSelectColumn({
            key: "firstName",
            query,
            target: newSqlTableColumn<{ Key: "firstName"; Type: string }>({
               key: "firstName",
               columnName: "first_name",
               tableInfo,
            }),
         }),
         $lastName: newSqlSelectColumn({
            key: "lastName",
            query,
            target: newSqlTableColumn<{ Key: "lastName"; Type: string }>({
               key: "lastName",
               columnName: "last_name",
               tableInfo,
            }),
         }),
         $notes: newSqlSelectColumn({
            key: "notes",
            query,
            target: newSqlTableColumn<{ Key: "notes"; Type: string }>({
               key: "notes",
               columnName: "notes",
               tableInfo,
            }),
         }),
         $status: newSqlSelectColumn({
            key: "status",
            query,
            target: newSqlTableColumn<{ Key: "status"; Type: AccountStatusUdt }>({
               key: "status",
               columnName: "status",
               tableInfo,
            }),
         }),
         $parentId: newSqlSelectColumn({
            key: "parentId",
            query,
            target: newSqlTableColumn<{ Key: "parentId"; Type: string }>({
               key: "parentId",
               columnName: "parent_id",
               tableInfo,
            }),
         }),
         $modifiedAt: newSqlSelectColumn({
            key: "modifiedAt",
            query,
            target: newSqlTableColumn<{ Key: "modifiedAt"; Type: Date }>({
               key: "modifiedAt",
               columnName: "modified_at",
               tableInfo,
            }),
         }),
         $orderId: newSqlSelectColumn({
            key: "orderId",
            query,
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
      const actual = target.getRowByQuery({ query: sql`` });
      expect(actual.$accountId).toBeDefined();
      expect(actual.$firstName).toBeDefined();
      expect(actual.$name).toBeDefined();
   });

   test("row(...columns) column should be defined", () => {
      const target = row(Account.$accountId, Account.$firstName, Account.$lastName);
      assertType<SqlSelectRow<{ Row: { accountId: string; firstName: string; lastName: string } }>>(target);
      const actual = target.getRowByQuery({ query: sql`` });
      expect(actual.$accountId).toBeDefined();
      expect(actual.$firstName).toBeDefined();
      expect(actual.$lastName).toBeDefined();
   });

   test("row($$) column should be defined", () => {
      const target = row(Account.$$);
      const actual = target.getRowByQuery({ query: sql`` });
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
      target.getRowByQuery({ query: sql`` });
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
      target.getRowByQuery({ query: sql`` });
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
      target.getRowByQuery({ query: sql`` });
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
      target.getRowByQuery({ query: sql`` });
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
            type: "SqlSelectColumn",
            key: "accountId",
            format: null,
            target: {
               type: "SqlTableColumn",
               columnName: "account_id",
               key: "accountId",
               tableInfo: {
                  name: "account",
                  schema: "valnor_test",
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
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      assertType<SqlQuery<{ Row: {}; Params: { accountId: string } }>>(query);
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
         type: "SqlSelectColumn",
         key: "accountId",
         format: null,
         target: {
            columnName: "account_id",
            key: "accountId",
            type: "SqlTableColumn",
            id: "SqlTableColumn#1(account.account_id as accountId)",
            tableInfo: {
               name: "account",
               schema: "valnor_test",
            },
         },
         query: {
            id: "SqlQuery#1",
         },
      });

      expect(query.$accountId).toBeInstanceOf(SqlSelectColumn);
      expect(query.$accountId.target).toBeInstanceOf(SqlTableColumn);

      expect(query.getSql({}).text).toMatchInlineSnapshot(`
        "SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."first_name" AS "firstName"
        FROM
          "valnor_test"."account" AS "a_1""
      `);

      const context = new SqlBuildContext({ query });
      context.next("where");
      query.$accountId.build(context);
      expect(context.text).toEqual(`"query_0"."accountId"`);
   });
});
