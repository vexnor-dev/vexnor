import { describe, expect, test } from "vitest";
import { DefaultTableRead } from "../default-table-read.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { sql } from "../../sql.js";
import { param } from "../../query/index.js";

describe("DefaultTableFind", () => {
   test("should create find instance", () => {
      const find = new DefaultTableRead(Account);
      expect(find).toBeDefined();
      expect(find.table).toBe(Account);
   });

   test("should generate find query without where clause", () => {
      const find = new DefaultTableRead(Account);
      const query = find.read({});

      expect(query).toBeDefined();
      const { text } = query.getSql({});
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
          "valnor_test"."account" AS "a_1"
          /* </query_0> */"
      `);
   });

   test("should generate find query with where clause", () => {
      const find = new DefaultTableRead(Account);
      const where = sql`where ${Account.$accountId} = ${param<{ id: string }>("id")}`;
      const query = find.read({ where });

      expect(query).toBeDefined();
      const { text } = query.getSql({ params: { id: "test-id" } });
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
          "valnor_test"."account" AS "a_1" (
            /* <query_1> */
            WHERE
              "a_2"."account_id" = ?
              /* </query_1> */
          ) AS "query_1"
          /* </query_0> */"
      `);
   });

   test("should return query with correct row type", () => {
      const find = new DefaultTableRead(Account);
      const query = find.read({});

      expect(query.row).toBeDefined();
   });
});
