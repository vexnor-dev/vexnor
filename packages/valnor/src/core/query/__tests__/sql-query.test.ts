import { describe, expect, test } from "vitest";
import { sql } from "../../sql.js";
import { info } from "../../charms/index.js";
import { row } from "../sql-select-row.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { AccountStatusUdt } from "@test-models/valnor_test-enums.js";
import { SqlBuildContext } from "../sql-build-context.js";

describe("SqlQuery tests", () => {
   test("SqlQuery row type inference", () => {
      const query = sql`select ${row(Account.$accountId, Account.$status, Account.$email)} from ${Account}`;
      expect(query.row).toBeDefined();
      expect(query.row).toMatchObject({
         $accountId: {
            type: "SqlRowColumn",
            key: "accountId",
            query: {
               id: "SqlQuery#1",
            },
            target: {
               type: "SqlTableColumn",
               key: "accountId",
            },
         },
         $status: {
            type: "SqlRowColumn",
            key: "status",
            query: {
               id: "SqlQuery#1",
            },
            target: {
               type: "SqlTableColumn",
               key: "status",
            },
         },
         $email: {
            type: "SqlRowColumn",
            key: "email",
            query: {
               id: "SqlQuery#1",
            },
            target: {
               type: "SqlTableColumn",
               key: "email",
            },
         },
      });
      expect(Object.keys(query.row)).toMatchObject(["$accountId", "$status", "$email"]);
      expect(query.$accountId).toBeDefined();
      expect(query.$status).toBeDefined();
      expect(query.$email).toBeDefined();
      expect(Reflect.ownKeys(query)).toMatchInlineSnapshot(`
        [
          "wrap",
          "id",
          "type",
          "rawStrings",
          "rawValues",
          "info",
          "inline",
          "format",
          "_queries",
          "_params",
          "_row",
          "_$$",
          "$accountId",
          "$status",
          "$email",
        ]
      `);
      expect(query.$$).toBeDefined();
   });

   test("join sub-query with default queryName", () => {
      const subQuery = sql`
            select ${row(Account.$accountId, Account.$status, Account.$email)}
            from ${Account}
            where ${Account.$status} = ${AccountStatusUdt.CREATED}
         `;

      const query = sql`join ${subQuery}`;
      const context = new SqlBuildContext({ query });
      query.build(context);
      expect(context.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        JOIN (
          /* <query_1> */
          SELECT
            "a_1"."account_id" AS "accountId",
            "a_1"."status",
            "a_1"."email"
          FROM
            "valnor_test"."account" AS "a_1"
          WHERE
            "a_1"."status" = ?
            /* </query_1> */
        ) AS "query_1"
        /* </query_0> */"
      `);
   });

   test("join sub-query with defined queryName", () => {
      const subQuery = sql`
         ${info({ label: "AccountsCreated" })}
            select ${row(Account.$accountId, Account.$status, Account.$email)}
            from ${Account}
            where ${Account.$status} = ${AccountStatusUdt.CREATED}
         `;
      const rootQuery = sql`join ${subQuery}`;

      const context = new SqlBuildContext();
      rootQuery.build(context);
      expect(context.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        JOIN (
          /* <AccountsCreated> */
          /* --label: AccountsCreated */
          SELECT
            "a_1"."account_id" AS "accountId",
            "a_1"."status",
            "a_1"."email"
          FROM
            "valnor_test"."account" AS "a_1"
          WHERE
            "a_1"."status" = ?
            /* </AccountsCreated> */
        ) AS "AccountsCreated"
        /* </query_0> */"
      `);
   });

   test("sql query formatting", () => {
      const query = sql`
            select ${row(Account.$accountId, Account.$status, Account.$email)}
            from ${Account}
         `;
      expect(query.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email"
        FROM
          "valnor_test"."account" AS "a_1"
          /* </query_0> */"
      `);
   });
});
