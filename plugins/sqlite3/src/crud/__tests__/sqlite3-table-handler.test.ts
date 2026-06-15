import { describe, expect, test } from "vitest";
import { newSqlite3TableHandler } from "#/crud/sqlite3-table-handler.js";
import { Account } from "@vexnor/core/testing";
import "@vexnor/sqlite3";
import { defaultQueryOptions } from "#/crud/default-query-options.js";
import { param, sql } from "@vexnor/core";

describe("newSqlite3TableHandler", () => {
   const handler = newSqlite3TableHandler(Account);

   test("findBy() — builds query object", () => {
      const query = handler.findBy();
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });

   test("findBy() — single field SQL", () => {
      const { text, values } = handler.findBy().source.getSql({
         params: { email: "a@b.com" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
          /* <query_2> */ "a_1"."email" = ? /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "a@b.com",
        ]
      `);
   });

   test("findById() — builds query object", () => {
      const query = handler.findById();
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });

   test("findById() — by PK SQL", () => {
      const { text, values } = handler.findById().source.getSql({
         params: { accountId: "id-1" },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "id-1",
        ]
      `);
   });

   test("select() — builds query object", () => {
      const query = handler.select({});
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });

   test("insertRows() — builds query object", () => {
      const query = handler.insertRows();
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });

   test("insertFrom() — builds query object", () => {
      const query = handler.insertFrom({ FROM: Account.sqlite.select({}).source });
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });

   test("update() — builds query object", () => {
      const query = handler.update({});
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });

   test("delete() — builds query object", () => {
      const query = handler.delete({ force: true });
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });

   test("upsert() — builds query object", () => {
      const query = handler.upsert({
         CONFLICT_ON: [Account.$accountId],
         SET: sql`${Account.$firstName} = ${param<{ firstName: string }>("firstName")}`,
      });
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });
});
