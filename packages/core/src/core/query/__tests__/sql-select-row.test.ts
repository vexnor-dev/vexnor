import { assertType, describe, expect, expectTypeOf, test } from "vitest";
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
import { TypeOf } from "#src/core/sql-base.js";
import { newSqlTable } from "#src/core/schema/sql-table.js";

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

   test("composes recursive table select-all output with an additional table column", () => {
      type DuckDBRecursiveSelect = {
         structValue: {
            label: string | null;
            coordinates: { latitude: number | null; longitude: number | null } | null;
         } | null;
         listValue: Array<{
            itemId: string | null;
            tags: Array<string | null> | null;
         } | null>;
         mapValue: Array<{
            key: string;
            value: { enabled: boolean | null; weights: Array<number | null> | null } | null;
         }>;
         unionValue: string | number | { code: string | null };
         nestedValue: {
            listOfMaps: Array<Array<{
               key: string;
               value: { payload: string | number | null } | null;
            }> | null> | null;
         } | null;
      };
      const RecursiveTable = newSqlTable<{
         Select: DuckDBRecursiveSelect;
         Source: "@vexnor/test:recursive-select-all";
      }>({
         crud: { select: true, insert: false, update: false, delete: false },
         tableInfo: { name: "recursive_table", schema: "main" },
         pk: [],
         dialect: "duckdb",
         source: "@vexnor/test:recursive-select-all",
         columns: {
            structValue: "struct_value",
            listValue: "list_value",
            mapValue: "map_value",
            unionValue: "union_value",
            nestedValue: "nested_value",
         },
      });
      const query = sql`
         select ${row(RecursiveTable.$$, Order.$orderId)}
         from ${RecursiveTable}
         join ${Order} on 1 = 1
      `;

      type QueryRow = TypeOf<typeof query>;
      expectTypeOf<QueryRow["structValue"]>().toEqualTypeOf<DuckDBRecursiveSelect["structValue"]>();
      expectTypeOf<QueryRow["listValue"]>().toEqualTypeOf<DuckDBRecursiveSelect["listValue"]>();
      expectTypeOf<QueryRow["mapValue"]>().toEqualTypeOf<DuckDBRecursiveSelect["mapValue"]>();
      expectTypeOf<QueryRow["unionValue"]>().toEqualTypeOf<DuckDBRecursiveSelect["unionValue"]>();
      expectTypeOf<QueryRow["nestedValue"]>().toEqualTypeOf<DuckDBRecursiveSelect["nestedValue"]>();
      expectTypeOf<QueryRow["orderId"]>().toEqualTypeOf<string>();

      const rejectInvalidRecursivePaths = (value: QueryRow) => {
         // @ts-expect-error - The composed result must not accept unknown top-level fields.
         void value.missingValue;
         // @ts-expect-error - Coordinates belong under structValue, not at the row root.
         void value.coordinates;
         // @ts-expect-error - The nested struct must retain its declared field names.
         void value.structValue?.coordinates?.altitude;
         // @ts-expect-error - Recursive list members use the declared output key, not the database-style key.
         void value.listValue[0]?.item_id;
         // @ts-expect-error - The map value struct must reject undeclared fields.
         void value.mapValue[0]?.value?.weight;
         if (typeof value.unionValue === "object") {
            // @ts-expect-error - The narrowed union struct must reject undeclared members.
            void value.unionValue.missingCode;
         }
         // @ts-expect-error - Deeply nested map values must retain their payload field exactly.
         void value.nestedValue?.listOfMaps[0]?.[0]?.value?.missingPayload;
         // @ts-expect-error - Recursive numeric leaves must not widen to string.
         const invalidLatitude: string | null | undefined = value.structValue?.coordinates?.latitude;
         return invalidLatitude;
      };

      expect(rejectInvalidRecursivePaths).toBeDefined();
      // @ts-expect-error - The query must expose only fields selected by $$ plus the explicit additional column.
      expect(query.$status).toBeUndefined();

      expect({
         postgresql: query.getSql({ options: { dialect: "postgresql" } }),
         sqlite: query.getSql({ options: { dialect: "sqlite" } }),
         transactsql: query.getSql({ options: { dialect: "transactsql" } }),
         duckdb: query.getSql({ options: { dialect: "duckdb" } }),
      }).toMatchInlineSnapshot(`
        {
          "duckdb": {
            "text": "/* <query_0> */
        SELECT
          "rt_1"."struct_value" AS "structValue",
          "rt_1"."list_value" AS "listValue",
          "rt_1"."map_value" AS "mapValue",
          "rt_1"."union_value" AS "unionValue",
          "rt_1"."nested_value" AS "nestedValue",
          "o_2"."order_id" AS "orderId"
        FROM
          "main"."recursive_table" AS "rt_1"
          JOIN "main"."order" AS "o_2" ON 1 = 1
          /* </query_0> */",
            "values": [],
          },
          "postgresql": {
            "text": "/* <query_0> */
        SELECT
          "rt_1"."struct_value" AS "structValue",
          "rt_1"."list_value" AS "listValue",
          "rt_1"."map_value" AS "mapValue",
          "rt_1"."union_value" AS "unionValue",
          "rt_1"."nested_value" AS "nestedValue",
          "o_2"."order_id" AS "orderId"
        FROM
          "main"."recursive_table" AS "rt_1"
          JOIN "main"."order" AS "o_2" ON 1 = 1
          /* </query_0> */",
            "values": [],
          },
          "sqlite": {
            "text": "/* <query_0> */
        SELECT
          "rt_1"."struct_value" AS "structValue",
          "rt_1"."list_value" AS "listValue",
          "rt_1"."map_value" AS "mapValue",
          "rt_1"."union_value" AS "unionValue",
          "rt_1"."nested_value" AS "nestedValue",
          "o_2"."order_id" AS "orderId"
        FROM
          "main"."recursive_table" AS "rt_1"
          JOIN "main"."order" AS "o_2" ON 1 = 1
          /* </query_0> */",
            "values": [],
          },
          "transactsql": {
            "text": "/* <query_0> */
        SELECT
          "rt_1"."struct_value" AS "structValue",
          "rt_1"."list_value" AS "listValue",
          "rt_1"."map_value" AS "mapValue",
          "rt_1"."union_value" AS "unionValue",
          "rt_1"."nested_value" AS "nestedValue",
          "o_2"."order_id" AS "orderId"
        FROM
          "main"."recursive_table" AS "rt_1"
          JOIN "main"."order" AS "o_2" ON 1 = 1
          /* </query_0> */",
            "values": [],
          },
        }
      `);
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
