import { describe, expect, test } from "vitest";
import { SqlTableDelete } from "../sql-table-delete.js";
import { Account } from "@test-models/valnor_test.schema.js";
import { sql } from "../../sql.js";
import { param } from "../../query/index.js";

describe("SqlTableDelete", () => {
   test("should create instance", () => {
      const del = new SqlTableDelete(Account);
      expect(del).toBeDefined();
      expect(del.table).toBe(Account);
   });

   test("should throw error without where or force", () => {
      const del = new SqlTableDelete(Account);
      expect(() =>
         del.delete({
            //@ts-expect-error build fails
            force: false,
         }),
      ).toThrow();
   });

   test("should generate delete query with where clause", () => {
      const del = new SqlTableDelete(Account);
      const where = sql`where ${Account.$accountId} = ${param<{ id: string }>("id")}`;
      const query = del.delete({ where });

      expect(query).toBeDefined();
      const { text } = query.getSql({ params: { where: { id: "test-id" } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        DELETE FROM "main"."account"
        /* <query_1> */
        WHERE
          /* <query_2> */
        WHERE
          "account"."account_id" = ?
          /* </query_2> */
          /* </query_1> */
          /* </query_0> */"
      `);
   });

   test("should generate delete query with force flag", () => {
      const del = new SqlTableDelete(Account);
      const query = del.delete({ force: true });

      expect(query).toBeDefined();
      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        DELETE FROM "main"."account"
        /* </query_0> */"
      `);
   });
});
