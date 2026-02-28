import { describe, expect, test } from "vitest";
import { DefaultTableUpdate } from "../default-table-update.js";
import { Account } from "../../__tests__/models/valnor_test.account-table.js";
import { sql } from "../../sql.js";
import { param } from "../../query/index.js";

describe("DefaultTableUpdate", () => {
   test("should create instance", () => {
      const update = new DefaultTableUpdate(Account);
      expect(update).toBeDefined();
      expect(update.table).toBe(Account);
   });

   test("should generate update query without where clause", () => {
      const update = new DefaultTableUpdate(Account);
      const query = update.update({});
      
      expect(query).toBeDefined();
      const { text } = query.getSql({ params: { value: { email: "new@test.com" } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "valnor_test"."account"
        SET
          /* <query_1> */
          "a_2"."email" = ?
          /* </query_1> */
          /* </query_0> */"
      `);
   });

   test("should generate update query with where clause", () => {
      const update = new DefaultTableUpdate(Account);
      const where = sql`where ${Account.$accountId} = ${param<{ id: string }>("id")}`;
      const query = update.update({ where });
      
      expect(query).toBeDefined();
      const { text } = query.getSql({ params: { value: { email: "new@test.com" }, where: { id: "test-id" } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "valnor_test"."account"
        SET
          /* <query_2> */
          "a_2"."email" = ?
          /* </query_2> */
          /* <query_1> */
        WHERE
          "a_3"."account_id" = ?
          /* </query_1> */
          /* </query_0> */"
      `);
   });

   test("should handle expand set clause", () => {
      const update = new DefaultTableUpdate(Account);
      const query = update.update({});
      
      const { text } = query.getSql({ params: { value: { email: "new@test.com" } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "valnor_test"."account"
        SET
          /* <query_1> */
          "a_2"."email" = ?
          /* </query_1> */
          /* </query_0> */"
      `);
   });
});
