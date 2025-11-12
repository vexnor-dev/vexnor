import { describe, expect, test } from "vitest";
import { InferResultRowFromAll, InferResultRowFromColumns, row } from "../sql-select-row.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { SqlBuildContext } from "../sql-build-context.js";
import { sql } from "../../sql.js";
import { param } from "../sql-param.js";
import { trim } from "../../utils/index.js";
import { AccountStatusUdt } from "@test-models/valnor_test-enums.js";
import { newSqlSelectColumn } from "../sql-select-column.js";
import { Order } from "@test-models/valnor_test.order-table.js";
import { InferSelectRowByResult } from "../sql-query-types.js";

describe("SqlSelectRow tests", () => {
   test("infer result row from select row", () => {
      type ResultRow = InferResultRowFromColumns<[typeof Account.$accountId, typeof Order.$orderId]>;
      const row: ResultRow = {
         accountId: "",
         orderId: "",
      };
      expect(row).toBeDefined();
   });

   test("infer SqlTable.$$all row", () => {
      type Type = InferSelectRowByResult<InferResultRowFromAll<typeof Account.$$all>>;
      const target: Type = {
         $accountId: newSqlSelectColumn<{ Key: "accountId"; Type: string }>({
            key: "accountId",
            columnName: "account_id",
         }),
         $createdAt: newSqlSelectColumn<{ Key: "createdAt"; Type: Date }>({
            key: "createdAt",
            columnName: "created_at",
         }),
         $email: newSqlSelectColumn<{ Key: "email"; Type: string }>({
            key: "email",
            columnName: "email",
         }),
         $firstName: newSqlSelectColumn<{ Key: "firstName"; Type: string }>({
            key: "firstName",
            columnName: "first_name",
         }),
         $lastName: newSqlSelectColumn<{ Key: "lastName"; Type: string }>({
            key: "lastName",
            columnName: "last_name",
         }),
         $notes: newSqlSelectColumn<{ Key: "notes"; Type: string }>({
            key: "notes",
            columnName: "notes",
         }),
         $status: newSqlSelectColumn<{ Key: "status"; Type: AccountStatusUdt }>({
            key: "status",
            columnName: "status",
         }),
         $parentId: newSqlSelectColumn<{ Key: "parentId"; Type: string }>({
            key: "parentId",
            columnName: "parent_id",
         }),
         $modifiedAt: newSqlSelectColumn<{ Key: "modifiedAt"; Type: Date }>({
            key: "modifiedAt",
            columnName: "modified_at",
         }),
      };

      expect(target).toBeDefined();
   });

   test("SqlSelectRow type inference from columns", () => {
      type Row = InferSelectRowByResult<
         InferResultRowFromColumns<[typeof Account.$accountId, typeof Account.$status, typeof Account.$createdAt]>
      >;
      const row: Row = {
         $accountId: newSqlSelectColumn<{ Key: "accountId"; Type: string }>({
            key: "accountId",
            columnName: "account_id",
         }),
         $createdAt: newSqlSelectColumn<{ Key: "createdAt"; Type: Date }>({
            key: "createdAt",
            columnName: "created_at",
         }),
         $status: newSqlSelectColumn<{ Key: "status"; Type: AccountStatusUdt }>({
            key: "status",
            columnName: "status",
         }),
      };
      expect(row).toBeDefined();
   });

   test("SqlSelectRow type inference from $$all + column", () => {
      type Row = InferSelectRowByResult<InferResultRowFromColumns<[typeof Account.$$all, typeof Order.$orderId]>>;
      const row: Row = {
         $accountId: newSqlSelectColumn<{ Key: "accountId"; Type: string }>({
            key: "accountId",
            columnName: "account_id",
         }),
         $createdAt: newSqlSelectColumn<{ Key: "createdAt"; Type: Date }>({
            key: "createdAt",
            columnName: "created_at",
         }),
         $email: newSqlSelectColumn<{ Key: "email"; Type: string }>({
            key: "email",
            columnName: "email",
         }),
         $firstName: newSqlSelectColumn<{ Key: "firstName"; Type: string }>({
            key: "firstName",
            columnName: "first_name",
         }),
         $lastName: newSqlSelectColumn<{ Key: "lastName"; Type: string }>({
            key: "lastName",
            columnName: "last_name",
         }),
         $notes: newSqlSelectColumn<{ Key: "notes"; Type: string }>({
            key: "notes",
            columnName: "notes",
         }),
         $status: newSqlSelectColumn<{ Key: "status"; Type: AccountStatusUdt }>({
            key: "status",
            columnName: "status",
         }),
         $parentId: newSqlSelectColumn<{ Key: "parentId"; Type: string }>({
            key: "parentId",
            columnName: "parent_id",
         }),
         $modifiedAt: newSqlSelectColumn<{ Key: "modifiedAt"; Type: Date }>({
            key: "modifiedAt",
            columnName: "modified_at",
         }),
         $orderId: newSqlSelectColumn<{ Key: "orderId"; Type: string }>({
            key: "orderId",
            columnName: "order_id",
         }),
      };

      expect(row).toBeDefined();
   });

   test("row(...columns) column should be defined", () => {
      const target = row(Account.$accountId, Account.$firstName, Account.$lastName);
      expect(target.$accountId).toBeDefined();
      expect(target.$firstName).toBeDefined();
      expect(target.$lastName).toBeDefined();
   });

   test("row($$all) column should be defined", () => {
      const target = row(Account.$$all);
      expect(target.$accountId).toBeDefined();
      expect(target.$firstName).toBeDefined();
      expect(target.$lastName).toBeDefined();
   });

   test("$build with distinct columns", () => {
      const target = row(Account.$accountId, Account.$firstName, Account.$lastName);
      const context = new SqlBuildContext();
      context.next("select");
      target.build(context);

      expect(context.text).toEqual(
         `"a_1"."account_id" as "accountId", "a_1"."first_name" as "firstName", "a_1"."last_name" as "lastName"`,
      );
   });

   test("$build with aliased column", () => {
      const target = row(Account.$accountId, Account.$firstName, Account.$lastName("name"));
      const context = new SqlBuildContext();
      context.next("select");
      target.build(context);

      expect(context.text).toEqual(
         `"a_1"."account_id" as "accountId", "a_1"."first_name" as "firstName", "a_1"."last_name" as "name"`,
      );
   });

   test("$build with aliased table and column", () => {
      const target = row(
         Account`inserted`.$accountId,
         Account`inserted`.$firstName,
         Account`inserted`.$lastName("name"),
      );
      const context = new SqlBuildContext();
      context.next("select");
      target.build(context);

      expect(context.text).toEqual(
         `"inserted"."account_id" as "accountId", "inserted"."first_name" as "firstName", "inserted"."last_name" as "name"`,
      );
   });

   test("$build with table.$$all", () => {
      const target = row(Account.$$all);
      const context = new SqlBuildContext();
      context.next("select");
      target.build(context);

      expect(context.text).toEqual(trim`
         "a_1"."account_id"  as "accountId",
         "a_1"."status",
         "a_1"."email",
         "a_1"."first_name"  as "firstName",
         "a_1"."last_name"   as "lastName",
         "a_1"."notes",
         "a_1"."created_at"  as "createdAt",
         "a_1"."modified_at" as "modifiedAt",
         "a_1"."parent_id"   as "parentId"`);
   });

   test("SqlRow $build with aliased table.$$all", () => {
      const target = row(Account`inserted`.$$all);
      const context = new SqlBuildContext();
      context.next("select");
      target.build(context);

      expect(context.text).toEqual(trim`
         "inserted"."account_id"  as "accountId",
         "inserted"."status",
         "inserted"."email",
         "inserted"."first_name"  as "firstName",
         "inserted"."last_name"   as "lastName",
         "inserted"."notes",
         "inserted"."created_at"  as "createdAt",
         "inserted"."modified_at" as "modifiedAt",
         "inserted"."parent_id"   as "parentId"`);
   });

   test("query.row is defined", () => {
      const query = sql`
         select ${row(Account.$accountId, Account.$status, Account.$firstName)}
         from ${Account}
         where ${Account.$accountId} = ${param("accountId").is<string>()}`;
      expect(query.row).toBeDefined();
   });

   test("query.row is not defined", () => {
      const query = sql`
         select ${(Account.$accountId, Account.$status, Account.$firstName)}
         from ${Account}
         where ${Account.$accountId} = ${param("accountId").is<string>()}`;
      expect(query.row).toBeFalsy();
   });

   test("query.row.[column] renders column", () => {
      const query = sql`
         select ${row(Account.$accountId, Account.$status, Account.$firstName)}
         from ${Account}`;
      console.log(query.toString());
      const context = new SqlBuildContext({ query });
      context.next("where");
      query.$accountId.build(context);
      expect(context.text).toEqual(`"query_0"."accountId"`);
   });
});
