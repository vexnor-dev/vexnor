import { describe, expect, test, beforeEach } from "vitest";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { Account, Order } from "@test-models/vexnor_dev.schema.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlJoinBy } from "#src/core/operators/sql-join-by.js";
import { SqlTable } from "#src/core/schema/sql-table.js";

function buildWithFilter(filterData: unknown) {
   const query = sqlSelect(Account, {});
   return query.getSql({ params: { filterBy: filterData as never }, options: { dialect: "sqlite" } });
}

function buildWithHaving(selectData: unknown, havingData: unknown) {
   const query = sqlSelect(Account, {});
   return query.getSql({ params: { select: selectData as never, havingBy: havingData as never }, options: { dialect: "sqlite" } });
}

describe("Operator edge cases — incorrect SQL generation", () => {
   describe("P2: empty IN produces IS NULL instead of FALSE", () => {
      test("filterBy empty in[] emits IS NULL (semantically wrong)", () => {
         // Empty IN-list means "matches nothing" — should be 1=0 or FALSE
         // Currently emits "col IS NULL" which matches NULL rows
         const { text, values } = buildWithFilter([{ status: ["in"] }]);
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
           WHERE
             1 = 0 /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("filterBy empty notIn[] emits IS NOT NULL (semantically wrong)", () => {
         // Empty NOT IN-list means "matches everything" — should be 1=1 or TRUE
         // Currently emits "col IS NOT NULL" which excludes NULL rows
         const { text, values } = buildWithFilter([{ status: ["notIn"] }]);
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
           WHERE
             /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("havingBy empty in[] emits IS NULL on aggregate", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["in"] }],
         );
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."status",
             count(*) AS "total"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
           GROUP BY
             "a_1"."status" /* </query_2> */
             /* <query_3> */
           HAVING
             count(*) IS NULL /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });
   });

   describe("P2: between with insufficient args", () => {
      test("filterBy between with 1 arg passes undefined as second bound", () => {
         // between requires 2 args. With 1 arg, args[1] is undefined.
         // addValues(undefined) produces broken SQL.
         const { text, values } = buildWithFilter([{ email: ["between", "a"] }]);
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
           WHERE
             "a_1"."email" BETWEEN ? AND ?  /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             "a",
             null,
           ]
         `);
      });

      test("filterBy between with 0 args emits IS NULL (semantically wrong)", () => {
         // Should throw since between always requires 2 args
         const { text, values } = buildWithFilter([{ email: ["between"] }]);
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
           WHERE
             "a_1"."email" IS NULL /* </query_1> */
             /* <query_2> */
             /* </query_2> */
             /* <query_3> */
             /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`[]`);
      });

      test("havingBy between with 1 arg passes undefined", () => {
         const { text, values } = buildWithHaving(
            { status: true, total: { fn: "count", col: "*" } },
            [{ total: ["between", 5] }],
         );
         expect(text).toMatchInlineSnapshot(`
           "/* <query_0> */
           SELECT
             "a_1"."status",
             count(*) AS "total"
           FROM
             "main"."account" AS "a_1"
             /* <query_1> */
             /* </query_1> */
             /* <query_2> */
           GROUP BY
             "a_1"."status" /* </query_2> */
             /* <query_3> */
           HAVING
             count(*) BETWEEN ? AND ?  /* </query_3> */
             /* </query_0> */"
         `);
         expect(values).toMatchInlineSnapshot(`
           [
             5,
             null,
           ]
         `);
      });
   });

   describe("P2: joinBy ON-tuple with wrong structure", () => {
      beforeEach(() => {
         SqlTable.register(Account);
         SqlTable.register(Order);
      });

      test("1-element tuple emits 'undefined' for op and right", () => {
         const join = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
         const context = new SqlBuildContext({
            dialect: "sqlite",
            params: {
               joinBy: {
                  account: { on: [["_.accountId"]] },
               },
            },
         });
         // Should throw due to malformed tuple. Currently destructures undefined.
         let error: Error | null = null;
         try {
            join.write(context);
         } catch (e) {
            error = e as Error;
         }
         // If it didn't throw, the SQL contains "undefined"
         if (!error) {
            expect(context.text).toMatchInlineSnapshot();
         } else {
            expect(error.message).toMatchInlineSnapshot(`"[joinBy] Invalid ON operator: "undefined". Allowed: =, <, <=, >, >=, <>"`);
         }
      });

      test("2-element tuple (missing right) emits undefined column ref", () => {
         const join = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
         const context = new SqlBuildContext({
            dialect: "sqlite",
            params: {
               joinBy: {
                  account: { on: [["_.accountId", "="]] },
               },
            },
         });
         let error: Error | null = null;
         try {
            join.write(context);
         } catch (e) {
            error = e as Error;
         }
         if (!error) {
            expect(context.text).toMatchInlineSnapshot();
         } else {
            expect(error.message).toMatchInlineSnapshot(`"Cannot read properties of undefined (reading 'indexOf')"`);
         }
      });

      test("empty ON array produces JOIN without ON clause", () => {
         const join = new SqlJoinBy(Order, "joinBy", undefined, { account: Account });
         const context = new SqlBuildContext({
            dialect: "sqlite",
            params: {
               joinBy: {
                  account: { on: [] },
               },
            },
         });
         // Empty ON with non-CROSS join should probably throw or default to CROSS
         join.write(context);
         expect(context.text).toMatchInlineSnapshot(`"JOIN "main"."account" ON"`);
      });
   });
});
