import { describe, expect, test } from "vitest";
import { Account } from "@test-models/valnor_test.account-table.js";
import { param } from "../../query/index.js";
import { sql } from "../../sql.js";
import { SqlTableRead } from "../sql-table-read.js";

describe("SqlTableRead", () => {
   test("should create find instance", () => {
      const find = new SqlTableRead(Account);
      expect(find).toBeDefined();
      expect(find.table).toBe(Account);
   });

   test("should generate find query without where clause", () => {
      const find = new SqlTableRead(Account);
      const query = find.read({});

      expect(query).toBeDefined();
      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* <query_1> */
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
          /* </query_1> */
        FROM
          "main"."account" AS "a_1"
          /* </query_0> */"
      `);
   });

   test("should generate find query with where clause", () => {
      const find = new SqlTableRead(Account);
      const query = find.read({ where: sql`${Account.$accountId} = ${param<{ id: string }>("id")}` });

      expect(query).toBeDefined();
      const { text } = query.getSql({ params: { where: { id: "test-id" } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* <query_1> */
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
          /* </query_1> */
        FROM
          "main"."account" AS "a_1"
          /* <query_2> */
        WHERE
          (
            /* <query_3> */
            "a_1"."account_id" = ?
            /* </query_3> */
          ) AS "query_3"
          /* </query_2> */
          /* </query_0> */"
      `);
   });

   test("should return query with correct row type", () => {
      const find = new SqlTableRead(Account);
      const query = find.read({});

      expect(query.row).toBeDefined();
   });
});
