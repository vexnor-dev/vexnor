import { describe, expect, test } from "vitest";
import { sqlSelect } from "#/core/crud/sql-select.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

describe("SqlPagination — runtime limit/offset", () => {
   test("limit only", () => {
      const query = sqlSelect(Account, {});
      const { text, values } = query.getSql({ params: { limit: 25 }, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
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
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
        LIMIT
          ?
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          25,
        ]
      `);
   });

   test("offset only", () => {
      const query = sqlSelect(Account, {});
      const { text, values } = query.getSql({ params: { offset: 10 }, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
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
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
        OFFSET
          ?
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          10,
        ]
      `);
   });

   test("limit + offset", () => {
      const query = sqlSelect(Account, {});
      const { text, values } = query.getSql({ params: { limit: 25, offset: 50 }, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
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
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
        LIMIT
          ?
        OFFSET
          ?
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          25,
          50,
        ]
      `);
   });

   test("no output when both are null", () => {
      const query = sqlSelect(Account, {});
      const { text, values } = query.getSql({ params: { limit: null, offset: null }, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
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
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`[]`);
   });

   test("no output when both are undefined (omitted)", () => {
      const query = sqlSelect(Account, {});
      const { text, values } = query.getSql({ params: {}, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
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
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`[]`);
   });

   test("combined with filter and orderBy", () => {
      const query = sqlSelect(Account, {});
      const { text, values } = query.getSql({
         params: {
            filterBy: [{ status: ["=", "active"] }],
            orderBy: { createdAt: "DESC" },
            limit: 10,
            offset: 0,
         },
         options: { dialect: "sqlite" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
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
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
        ORDER BY
          "a_1"."created_at" DESC
        LIMIT
          ?
        OFFSET
          ?
          /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          10,
          0,
        ]
      `);
   });
});
