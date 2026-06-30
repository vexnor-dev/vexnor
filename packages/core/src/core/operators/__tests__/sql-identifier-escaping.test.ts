import { describe, expect, test, beforeEach } from "vitest";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { Account, Order } from "@test-models/vexnor_dev.schema.js";
import { SqlTable } from "#src/core/schema/sql-table.js";

function buildWithSelect(selectData: unknown, dialect: "sqlite" | "postgresql" | "transactsql" = "sqlite") {
   const query = sqlSelect(Account, {});
   return query.getSql({ params: { select: selectData as never }, options: { dialect } });
}

describe("Identifier escaping gaps", () => {
   beforeEach(() => {
      SqlTable.register(Account);
      SqlTable.register(Order);
   });

   describe("P1: projectBy alias keys containing double-quotes break identifier quoting", () => {
      test("alias with double-quote breaks out of AS identifier", () => {
         // Alias keys are emitted as: as "${alias}" without escaping " inside the alias.
         // A key like: foo"; DROP TABLE x; -- would produce: as "foo"; DROP TABLE x; --"
         const { text } = buildWithSelect(
            { 'foo"; DROP TABLE users; --': "email" },
            "sqlite",
         );
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."email" AS "foo""; DROP TABLE users; --"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });

      test("alias with double-quote in aggregate", () => {
         const { text } = buildWithSelect(
            { 'cnt"; DROP TABLE x; --': { fn: "count", col: "*" } },
            "sqlite",
         );
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             count(*) AS "cnt""; DROP TABLE x; --"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
      });
   });

   describe("P1: orderBy emits unescaped field as identifier when not in columnMap", () => {
      test("aggregate alias with double-quote passes through unescaped", () => {
         // When columnCount > 0 but field is not found, falls back to: context.addStrings(`"${field}"`)
         // To trigger columnCount > 0 we need joinBy param so SqlPreColumnMap populates columns.
         const query = sqlSelect(Account, {});
         const { text } = query.getSql({
            params: {
               joinBy: { order: { on: [["_.accountId", "=", "order.accountId"]] } },
               orderBy: { 'total"; DROP TABLE x; --': "DESC" },
            } as never,
            options: { dialect: "sqlite" },
         });
         // The field contains a double-quote, which breaks out of the identifier quoting
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
             /* <query_3> */
             /* </query_3> */
           ORDER BY
             "total""; DROP TABLE x; --" DESC
             /* </query_0> */"
         `);
      });
   });
});
