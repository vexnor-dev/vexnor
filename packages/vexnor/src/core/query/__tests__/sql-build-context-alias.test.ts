import { describe, expect, test } from "vitest";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { sql } from "#/core/sql.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { row } from "#/core/query/sql-select-row.js";
import { val } from "#/core/query/sql-select-value.js";

describe("SqlBuildContext alias tests", () => {
   test("'account' should alias 'a_1'", () => {
      const ctx = new SqlBuildContext({});
      const actual = ctx.getAlias({ name: "account", schema: "vexnor_dev" });
      expect(actual).toBe("a_1");
   });

   test("'account' should alias 'a_1', 'order' should alias 'o_2'", () => {
      const ctx = new SqlBuildContext({});
      const account = ctx.getAlias({ name: "account", schema: "vexnor_dev" });
      const order = ctx.getAlias({ name: "order", schema: "vexnor_dev" });
      expect(account).toBe("a_1");
      expect(order).toBe("o_2");
   });

   test("'order_item' should alias 'oi_1'", () => {
      const ctx = new SqlBuildContext({});
      const actual = ctx.getAlias({ name: "order_item", schema: "vexnor_dev" });
      expect(actual).toBe("oi_1");
   });

   test("'account' should alias 'a_1', 'order' should alias 'o_2', 'account' should alias 'a_1'", () => {
      const ctx = new SqlBuildContext({});
      const account1 = ctx.getAlias({ name: "account", schema: "vexnor_dev" });
      const order = ctx.getAlias({ name: "order", schema: "vexnor_dev" });
      const account2 = ctx.getAlias({ name: "account", schema: "vexnor_dev" });
      expect(account1).toBe("a_1");
      expect(order).toBe("o_2");
      expect(account2).toBe("a_1");
   });

   test("'account' with known alias 'parent' should alias 'parent'", () => {
      const ctx = new SqlBuildContext({});
      const actual = ctx.getAlias({ name: "account", schema: "vexnor_dev", alias: "parent" });
      expect(actual).toBe("parent");
   });

   test("should fill aliases", () => {
      const ctx = new SqlBuildContext({});

      const totalChildrenAccounts = sql`
         select ${val`count(*)`.as<{ total: number }>("total")}
         from ${Account}
         where ${Account.$parentId} = ${Account.out.$accountId}`;

      const query = sql`
         select ${row(Account.$$, totalChildrenAccounts.$total)}
         from ${Account}`;

      query.build(ctx, {});

      expect(ctx.text).toMatchInlineSnapshot(`
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
          "a_1"."parent_id" AS "parentId",
          "query_1"."total"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);

      // expect(alias).toBe("a_1");
   });

   test("should fill outer alias", () => {
      const totalChildren = sql`
       select ${val`count(*)`.as<{ total: number }>("total")}
       from ${Account}
       where ${Account.$parentId} = ${Account.out.$accountId}
    `;

      const query = sql`
         select ${row(Account.$$, totalChildren.$total.render("(sql) AS columnAlias"))}
         from ${Account}`;
      const ctx = new SqlBuildContext({ query });
      query.build(ctx);

      expect(ctx.text).toMatchInlineSnapshot(`
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
          "a_1"."parent_id" AS "parentId",
          (
            /* <query_1> */
            SELECT
              /* <query_2> */ count(*) /* </query_2> */ AS "total"
            FROM
              "main"."account" AS "a_2"
            WHERE
              "a_2"."parent_id" = "a_1"."account_id"
              /* </query_1> */
          ) AS "total"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });
});
