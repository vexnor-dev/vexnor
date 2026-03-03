import { describe, expect, test } from "vitest";
import { Account } from "../../__tests__/models/valnor_test.schema.js";
import { sql } from "../../sql.js";
import { SqlTableCreate } from "../sql-table-create.js";

describe("SqlTableCreate", () => {
   test("should create instance", () => {
      const create = new SqlTableCreate(Account);
      expect(create).toBeDefined();
      expect(create.table).toBe(Account);
   });

   test("should generate insert query without from clause", () => {
      const create = new SqlTableCreate(Account);
      const query = create.create({});

      expect(query).toBeDefined();
      const { text } = query.getSql({
         params: { inserts: [{ email: "test@test.com", firstName: "John", lastName: "Doe" }] },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "valnor_test"."account"
          /* <query_1> */
          /* --inline: true */
          ("email", "first_name", "last_name")
          /* </query_1> */
        VALUES
          /* <query_2> */
          (?, ?, ?)
          /* </query_2> */
          returning "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
   });

   test("should generate insert query with from subquery", () => {
      const create = new SqlTableCreate(Account);
      const from = sql`select * from ${Account} where ${Account.$status} = 'active'`;
      const query = create.create({ from });

      expect(query).toBeDefined();
      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "valnor_test"."account"
          /* <query_1> */
        SELECT
          *
        FROM
          "valnor_test"."account" AS "a_2"
        WHERE
          "a_2"."status" = 'active'
          /* </query_1> */
          returning "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
   });

   test("should handle expand columns correctly", () => {
      const create = new SqlTableCreate(Account);
      const query = create.create({});

      const { text } = query.getSql({
         params: { inserts: [{ email: "test@test.com", firstName: "John", lastName: "Doe" }] },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "valnor_test"."account"
          /* <query_1> */
          /* --inline: true */
          ("email", "first_name", "last_name")
          /* </query_1> */
        VALUES
          /* <query_2> */
          (?, ?, ?)
          /* </query_2> */
          returning "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);
   });
});
