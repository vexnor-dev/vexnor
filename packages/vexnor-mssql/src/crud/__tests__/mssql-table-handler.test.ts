import { describe, expect, test } from "vitest";
import { newMssqlTableHandler } from "#/crud/mssql-table-handler.js";
import { Account } from "vexnor/testing";
import "vexnor-mssql";
import { defaultQueryOptions } from "#/default-query-options.js";

describe("newMssqlTableHandler", () => {
   const handler = newMssqlTableHandler(Account);

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
        /* driver: transactsql */
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
          /* <query_2> */ "a_1"."email" = @param_0 /* </query_2> */ /* </query_1> */
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
        /* driver: transactsql */
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
          /* <query_2> */ "a_1"."account_id" = @param_0 /* </query_2> */ /* </query_1> */
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
      const query = handler.insertFrom({ FROM: Account.mssql.select({}).source });
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
      const query = handler.upsert({ MERGE_ON: [Account.$accountId] });
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });
});
