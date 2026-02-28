import { describe, expect, test } from "vitest";
import { newSqlTable } from "../../schema/index.js";
import { crud } from "../default-crud.js";
import { sql } from "../../sql.js";
import { param } from "../../query/index.js";

describe("SqlTable CRUD Integration", () => {
   const BaseTable = newSqlTable<{
      Select: { id: string; name: string; email: string };
      Insert: { id?: string; name: string; email: string };
      Update: { name?: string; email?: string };
      Delete: true;
   }>({
      crud: {
         find: true,
         create: true,
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
   const TestTable = crud(BaseTable);

   test("should create CRUD-capable table", () => {
      expect(TestTable).toBeDefined();
      expect(TestTable.find).toBeDefined();
      expect(TestTable.create).toBeDefined();
      expect(TestTable.update).toBeDefined();
      expect(TestTable.delete).toBeDefined();
   });

   test("find should generate select query", () => {
      const query = TestTable.find({});
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
      const query = TestTable.find({ where });

      const { text } = query.getSql({ params: { id: "test-id" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "tt_1"."id",
          "tt_1"."name",
          "tt_1"."email"
        FROM
          "public"."test_table" AS "tt_1" (
            /* <query_1> */
            WHERE
              "tt_2"."id" = ?
              /* </query_1> */
          ) AS "query_1"
          /* </query_0> */"
      `);
   });

   test("create should generate insert query", () => {
      const query = TestTable.create({});
      const { text } = query.getSql({ params: { inserts: [{ name: "Test", email: "test@test.com" }] } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "public"."test_table"
          /* <query_1> */
          /* --inline: true */
          ("name", "email")
          /* </query_1> */
        VALUES
          /* <query_2> */
          (?, ?)
          /* </query_2> */
          returning "test_table"."id",
          "test_table"."name",
          "test_table"."email"
          /* </query_0> */"
      `);
   });

   test("create with from subquery", () => {
      const from = sql`select * from ${BaseTable}`;
      const query = TestTable.create({ from });

      const { text } = query.getSql({
         params: { inserts: [{ name: "Test", email: "test@test.com" }], from: undefined },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "public"."test_table"
          /* <query_1> */
        SELECT
          *
        FROM
          "public"."test_table" AS "tt_2"
          /* </query_1> */
          returning "test_table"."id",
          "test_table"."name",
          "test_table"."email"
          /* </query_0> */"
      `);
   });

   test("update should generate update query", () => {
      const query = TestTable.update({});
      const { text } = query.getSql({ params: { value: { name: "Updated" } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "public"."test_table"
        SET
          /* <query_1> */
          "tt_2"."name" = ?
          /* </query_1> */
          /* </query_0> */"
      `);
   });

   test("update with where clause", () => {
      const where = sql`where ${BaseTable.$id} = ${param<{ id: string }>("id")}`;
      const query = TestTable.update({ where });

      const { text } = query.getSql({ params: { value: { name: "Updated" }, where: { id: "test-id" } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "public"."test_table"
        SET
          /* <query_2> */
          "tt_2"."name" = ?
          /* </query_2> */
          /* <query_1> */
        WHERE
          "tt_3"."id" = ?
          /* </query_1> */
          /* </query_0> */"
      `);
   });

   test("delete should require where or force", () => {
      expect(() => TestTable.delete({})).toThrow();
   });

   test("delete with where clause", () => {
      const where = sql`where ${BaseTable.$id} = ${param<{ id: string }>("id")}`;
      const query = TestTable.delete({ where });

      const { text } = query.getSql({ params: { where: { id: "test-id" } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        DELETE FROM "public"."test_table"
        /* <query_1> */
        WHERE
          "tt_2"."id" = ?
          /* </query_1> */
          /* </query_0> */"
      `);
   });

   test("delete with force flag", () => {
      const query = TestTable.delete({ force: true });
      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        DELETE FROM "public"."test_table"
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
      const ReadOnlyTable = crud(
         newSqlTable<{
            Select: { id: string; name: string };
         }>({
            crud: {
               find: true,
               create: false,
               update: false,
               delete: false,
            },
            tableInfo: { name: "readonly_table" },
            pk: ["id"],
            columns: { id: "id", name: "name" },
         }),
      );

      expect(ReadOnlyTable.find).toBeDefined();
   });

   test("table without Delete should not have delete", () => {
      const NoDeleteTable = crud(
         newSqlTable<{
            Select: { id: string };
            Insert: { id: string };
            Update: { id: string };
         }>({
            crud: {
               find: true,
               create: true,
               update: true,
               delete: false,
            },
            tableInfo: { name: "no_delete_table" },
            pk: ["id"],
            columns: { id: "id" },
         }),
      );

      expect(NoDeleteTable.find).toBeDefined();
      expect(NoDeleteTable.create).toBeDefined();
      expect(NoDeleteTable.update).toBeDefined();
   });
});
