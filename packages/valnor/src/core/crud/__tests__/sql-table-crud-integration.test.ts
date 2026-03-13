import { assertType, describe, expect, test } from "vitest";
import { newSqlTable } from "#/core/schema/sql-table.js";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { param } from "#/core/query/sql-param.js";
import { input } from "#/core/query/sql-input.js";
import { newSqlTableCrud, sqlCrud } from "#/core/crud/sql-table-crud.js";
import { SqlQuery, SqlQueryExtended } from "#/core/query/sql-query.js";

describe("SqlTable CRUD Integration", () => {
   const BaseTable = newSqlTable<{
      Select: { id: string; name: string; email: string };
      Insert: { id?: string; name: string; email: string };
      Update: { name?: string; email?: string };
      Delete: true;
   }>({
      crud: {
         select: true,
         insert: true,
         update: true,
         delete: true,
      },
      tableInfo: { name: "test_table", schema: "public" },
      pk: ["id"],
      columns: {
         id: "id",
         name: "name",
         email: "email",
      },
   });
   const TestTable = newSqlTableCrud(BaseTable, sqlCrud);
   TestTable.select({});

   test("should create CRUD-capable table", () => {
      expect(TestTable).toBeDefined();
      expect(TestTable.select).toBeDefined();
      expect(TestTable.insertFrom).toBeDefined();
      expect(TestTable.update).toBeDefined();
      expect(TestTable.delete).toBeDefined();
   });

   test("find should generate select query", () => {
      const query = TestTable.select({});
      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "tt_1"."id",
          "tt_1"."name",
          "tt_1"."email"
        FROM
          "public"."test_table" AS "tt_1"
          /* </query_0> */"
      `);
   });

   test("find with where clause", () => {
      const where = sql`where ${BaseTable.$id} = ${param<{ id: string }>("id")}`;
      const query = TestTable.select({ WHERE: where });

      const { text } = query.getSql({ params: { id: "test-id" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "tt_1"."id",
          "tt_1"."name",
          "tt_1"."email"
        FROM
          "public"."test_table" AS "tt_1"
          /* <query_1> */
        WHERE
          /* <query_2> */
        WHERE
          "tt_1"."id" = ? /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
   });

   test("create should generate insert query", () => {
      const query = TestTable.insertRows();
      const { text } = query.getSql({ params: { rows: [{ name: "Test", email: "test@test.com" }] } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "public"."test_table" ("name", "email")
        VALUES
          /* <query_1> */
          (?, ?) /* </query_1> */ returning "test_table"."id",
          "test_table"."name",
          "test_table"."email"
          /* </query_0> */"
      `);
   });

   test("create with from subquery", () => {
      const query = TestTable.insertFrom({
         FROM: sql`select ${row(BaseTable.$$)} from ${BaseTable}`,
      });

      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "public"."test_table"
          /* <query_1> */
        SELECT
          "tt_1"."id",
          "tt_1"."name",
          "tt_1"."email"
        FROM
          "public"."test_table" AS "tt_1" /* </query_1> */ returning "test_table"."id",
          "test_table"."name",
          "test_table"."email"
          /* </query_0> */"
      `);
   });

   test("update should generate update query", () => {
      const query = TestTable.update({});
      assertType<SqlQueryExtended<{ Row: { id: string; name: string; email: string } }>>(query);
      const { text } = query.getSql({ params: { set: { name: "Updated" } }, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "public"."test_table"
        /* <query_1> */
        SET
          /* <query_2> */ "name" = ? /* </query_2> */ /* </query_1> */
        RETURNING
          "test_table"."id",
          "test_table"."name",
          "test_table"."email"
          /* </query_0> */"
      `);
   });

   test("update with where clause", () => {
      type Select = { id: string; name: string; email: string };
      const params = input<{ id: string }>();
      const query = TestTable.update({ WHERE: sql`where ${BaseTable.$id} = ${params.$id}` });

      assertType<SqlQuery<{ Row: Select; Params: { set: Partial<Select>; id: string } }>>(query);

      const { text } = query.getSql({
         params: { set: { name: "Updated" }, id: "test-id" },
         options: { dialect: "sqlite" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "public"."test_table"
        /* <query_1> */
        SET
          /* <query_2> */ "name" = ? /* </query_2> */ /* </query_1> */
          /* <query_3> */
        WHERE
          /* <query_4> */
        WHERE
          "test_table"."id" = ? /* </query_4> */ /* </query_3> */
        RETURNING
          "test_table"."id",
          "test_table"."name",
          "test_table"."email"
          /* </query_0> */"
      `);
   });

   test("delete should require where or force", () => {
      expect(() =>
         TestTable.delete({
            //@ts-expect-error build fails
            force: false,
         }),
      ).toThrow();
   });

   test("delete with where clause", () => {
      const query = TestTable.delete({
         WHERE: sql`${BaseTable.$id} = ${param<{ id: string }>("id")}`,
      });

      const { text } = query.getSql({ params: { id: "test-id" }, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        DELETE FROM "public"."test_table"
        /* <query_1> */
        WHERE
          /* <query_2> */ "tt_1"."id" = ? /* </query_2> */ /* </query_1> */
        RETURNING
          "test_table"."id",
          "test_table"."name",
          "test_table"."email"
          /* </query_0> */"
      `);
   });

   test("delete with force flag", () => {
      const query = TestTable.delete({ force: true });
      const { text } = query.getSql({ options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        DELETE FROM "public"."test_table"
        RETURNING
          "test_table"."id",
          "test_table"."name",
          "test_table"."email"
          /* </query_0> */"
      `);
   });

   test("should preserve table properties", () => {
      expect(TestTable.tableInfo.name).toBe("test_table");
      expect(TestTable.tableInfo.schema).toBe("public");
      expect(TestTable.pk).toEqual(["id"]);
   });

   test("should access columns through base table", () => {
      expect(BaseTable.$id).toBeDefined();
      expect(BaseTable.$name).toBeDefined();
      expect(BaseTable.$email).toBeDefined();
   });

   test("should support table aliasing", () => {
      const aliased = BaseTable.as("t");
      expect(aliased.tableInfo.alias).toBe("t");
      expect(aliased.$id.tableInfo.alias).toBe("t");
   });
});

describe("SqlTable CRUD Partial Support", () => {
   test("table with only Select should have find only", () => {
      const ReadOnlyTable = newSqlTableCrud(
         newSqlTable<{
            Select: { id: string; name: string };
         }>({
            crud: {
               select: true,
               insert: false,
               update: false,
               delete: false,
            },
            tableInfo: { name: "readonly_table" },
            pk: ["id"],
            columns: { id: "id", name: "name" },
         }),
         sqlCrud,
      );

      expect(ReadOnlyTable.select).toBeDefined();
   });

   test("table without Delete should not have delete", () => {
      const NoDeleteTable = newSqlTableCrud(
         newSqlTable<{
            Select: { id: string };
            Insert: { id: string };
            Update: { id: string };
         }>({
            crud: {
               select: true,
               insert: true,
               update: true,
               delete: false,
            },
            tableInfo: { name: "no_delete_table" },
            pk: ["id"],
            columns: { id: "id" },
         }),
         sqlCrud,
      );

      expect(NoDeleteTable.select).toBeDefined();
      expect(NoDeleteTable.insertFrom).toBeDefined();
      expect(NoDeleteTable.update).toBeDefined();
   });
});
