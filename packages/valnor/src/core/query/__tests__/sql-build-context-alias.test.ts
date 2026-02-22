import { describe, expect, test } from "vitest";
import { SqlBuildContext } from "../sql-build-context.js";
import { sql } from "../../sql.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { row } from "../sql-select-row.js";
import { val } from "../sql-select-value.js";
import { col } from "../sql-select-field.js";

describe("SqlBuildContext alias tests", () => {
   test("'account' should alias 'a_1'", () => {
      const ctx = new SqlBuildContext({});
      const actual = ctx.alias({ name: "account", schema: "valnor_test" });
      expect(actual).toBe("a_1");
   });

   test("'account' should alias 'a_1', 'order' should alias 'o_2'", () => {
      const ctx = new SqlBuildContext({});
      const account = ctx.alias({ name: "account", schema: "valnor_test" });
      const order = ctx.alias({ name: "order", schema: "valnor_test" });
      expect(account).toBe("a_1");
      expect(order).toBe("o_2");
   });

   test("'order_item' should alias 'oi_1'", () => {
      const ctx = new SqlBuildContext({});
      const actual = ctx.alias({ name: "order_item", schema: "valnor_test" });
      expect(actual).toBe("oi_1");
   });

   test("'account' should alias 'a_1', 'order' should alias 'o_2', 'account' should alias 'a_1'", () => {
      const ctx = new SqlBuildContext({});
      const account1 = ctx.alias({ name: "account", schema: "valnor_test" });
      const order = ctx.alias({ name: "order", schema: "valnor_test" });
      const account2 = ctx.alias({ name: "account", schema: "valnor_test" });
      expect(account1).toBe("a_1");
      expect(order).toBe("o_2");
      expect(account2).toBe("a_1");
   });

   test("'account' with known alias 'parent' should alias 'parent'", () => {
      const ctx = new SqlBuildContext({});
      const actual = ctx.alias({ name: "account", schema: "valnor_test", alias: "parent" });
      expect(actual).toBe("parent");
   });

   test("should return alias id", () => {
      const ctx = new SqlBuildContext({});
      const totalChildren = sql`select count(*) as ${col<{ total: number }>("total")} from ${Account} where ${Account.$parentId} = ${Account.out.$accountId}`;
      const query = sql`select ${row(Account.$$, totalChildren.$total)} from ${Account}`;
      const actual = ctx.scope({ query }, () => {
         return ctx.getAliasId(Account.$parentId.tableInfo);
      });
      expect(actual).toEqual("SqlQuery#2/valnor_test.account");
   });

   test("should return alias ids", () => {
      const ctx = new SqlBuildContext({});
      const totalChildren = sql`select count(*) as ${col<{ total: number }>("total")} from ${Account} where ${Account.$parentId} = ${Account.out.$accountId}`;
      const query = sql`select ${row(Account.$$, totalChildren.$total)} from ${Account}`;
      const actual = ctx.scope({ query }, () => {
         query.build(ctx, {});
         return Array.from(ctx.getAliasIds(Account.out.$parentId.tableInfo));
      });
      expect(actual).toMatchObject(["SqlQuery#2/valnor_test.account", "-/valnor_test.account"]);
      expect(ctx["_tableAliasById"]).toMatchInlineSnapshot(`
        Map {
          "SqlQuery#2/valnor_test.account" => "a_1",
        }
      `);
   });

   test("should return aliases", () => {
      const ctx = new SqlBuildContext({});
      const totalChildrenAccounts = sql`select ${val`count(*)`.as<{ total: number }>("total")} from ${Account} where ${Account.$parentId} = ${Account.out.$accountId}`;
      const query = sql`select ${row(Account.$$, totalChildrenAccounts.$total)} from ${Account}`;
      const actual = ctx.scope({ query }, () => {
         query.build(ctx, {});
         return ctx.alias(Account.out.$parentId.tableInfo);
      });
      expect(ctx["_tableAliasById"]).toMatchInlineSnapshot(`
        Map {
          "SqlQuery#3/valnor_test.account" => "a_1",
        }
      `);
      expect(actual).toEqual("a_1");
   });

   test("should return outer alias", () => {
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
      const actual = ctx.scope({ query }, () => ctx.alias(Account.out.$accountId.tableInfo));
      expect(actual).toEqual("a_1");

      expect(ctx.text).toMatchInlineSnapshot(`
        "SELECT
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
            SELECT
              count(*) AS "total"
            FROM
              "valnor_test"."account" AS "a_2"
            WHERE
              "a_2"."parent_id" = "a_1"."account_id"
          ) AS "total"
        FROM
          "valnor_test"."account" AS "a_1""
      `);
   });
});
