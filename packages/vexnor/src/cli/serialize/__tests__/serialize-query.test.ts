import { describe, expect, test } from "vitest";
import { serializeQuery } from "#/core/serialize/serialize-query.js";
import { sql } from "#/core/sql.js";
import { param } from "#/core/query/sql-param.js";
import { row } from "#/core/query/sql-select-row.js";
import { when } from "#/core/query/sql-when.js";
import { set } from "#/core/query/sql-set.js";
import { insert } from "#/core/query/sql-insert-x.js";
import { filterBy } from "#/core/query/sql-filter-by.js";
import { orderBy } from "#/core/query/sql-order-by.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

type P = { status: string; hasEmail: boolean; email: string };
type UpdateP = { set: Record<string, unknown>; accountId: string };

describe("serializeQuery", () => {
   test("simple query with param()", async () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${Account.$status} = ${param<{ status: string }>("status")}
      `;

      const result = await serializeQuery(query, "findByStatus", "postgresql");

      const { hash, ...stable } = result;
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(stable).toMatchInlineSnapshot(`
        {
          "authorization": [],
          "location": null,
          "name": "findByStatus",
          "params": {
            "status": {
              "isContext": false,
              "name": "status",
            },
          },
          "row": {
            "createdAt": {
              "type": "Date",
            },
            "modifiedAt": {
              "type": "Date",
            },
          },
          "template": [
            {
              "type": "text",
              "value": " /* <query_0> */ 
                 SELECT "a_1"."account_id" as "accountId", "a_1"."status", "a_1"."email", "a_1"."first_name" as "firstName", "a_1"."last_name" as "lastName", "a_1"."notes", "a_1"."created_at" as "createdAt", "a_1"."modified_at" as "modifiedAt", "a_1"."parent_id" as "parentId"
                 FROM "main"."account" as "a_1"
                 WHERE "a_1"."status" = ",
            },
            {
              "name": "status",
              "type": "param",
            },
            {
              "type": "text",
              "value": "
              /* </query_0> */",
            },
          ],
        }
      `);
   });

   test("when() operator", async () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${Account.$status} = ${param<P>("status")}
         ${when("hasEmail", sql`AND ${Account.$email} = ${param<P>("email")}`)}
      `;

      const result = await serializeQuery(query, "conditionalFilter", "postgresql");

      const { ...stable } = result;
      expect(stable).toMatchInlineSnapshot(`
        {
          "authorization": [],
          "hash": "67e1ef2ef581023dfb7e56ebd3df10c2b3ff926d368566d308c3dadff72706c6",
          "location": null,
          "name": "conditionalFilter",
          "params": {
            "email": {
              "isContext": false,
              "name": "email",
            },
            "hasEmail": {
              "isContext": false,
              "name": "hasEmail",
            },
            "status": {
              "isContext": false,
              "name": "status",
            },
          },
          "row": {
            "createdAt": {
              "type": "Date",
            },
            "modifiedAt": {
              "type": "Date",
            },
          },
          "template": [
            {
              "type": "text",
              "value": " /* <query_0> */ 
                 SELECT "a_1"."account_id" as "accountId", "a_1"."status", "a_1"."email", "a_1"."first_name" as "firstName", "a_1"."last_name" as "lastName", "a_1"."notes", "a_1"."created_at" as "createdAt", "a_1"."modified_at" as "modifiedAt", "a_1"."parent_id" as "parentId"
                 FROM "main"."account" as "a_1"
                 WHERE "a_1"."status" = ",
            },
            {
              "name": "status",
              "type": "param",
            },
            {
              "type": "text",
              "value": "
                 ",
            },
            {
              "onTrue": [
                {
                  "type": "text",
                  "value": " /* <query_0> */ AND "a_1"."email" = ",
                },
                {
                  "name": "email",
                  "type": "param",
                },
                {
                  "type": "text",
                  "value": "/* </query_0> */",
                },
              ],
              "param": "hasEmail",
              "type": "when",
            },
            {
              "type": "text",
              "value": "
              /* </query_0> */",
            },
          ],
        }
      `);
   });

   test("set() operator", async () => {
      const query = sql`
         UPDATE ${Account}
         ${set(Account)}
         WHERE ${Account.$accountId} = ${param<UpdateP>("accountId")}
      `;

      const result = await serializeQuery(query, "updateAccount", "postgresql");

      const { ...stable } = result;
      expect(stable).toMatchInlineSnapshot(`
        {
          "authorization": [],
          "hash": "4b542876467f34f3f4dd06f36ab5354ecb8c4b63bb0a87ef07f887ddf282df63",
          "location": null,
          "name": "updateAccount",
          "params": {
            "accountId": {
              "isContext": false,
              "name": "accountId",
            },
            "set": {
              "isContext": false,
              "name": "set",
            },
          },
          "row": null,
          "template": [
            {
              "type": "text",
              "value": " /* <query_0> */ 
                 UPDATE "main"."account"
                 ",
            },
            {
              "columns": {
                "accountId": ""account_id"",
                "createdAt": ""created_at"",
                "email": ""email"",
                "firstName": ""first_name"",
                "lastName": ""last_name"",
                "modifiedAt": ""modified_at"",
                "notes": ""notes"",
                "parentId": ""parent_id"",
                "status": ""status"",
              },
              "param": "set",
              "type": "set",
            },
            {
              "type": "text",
              "value": "
                 WHERE "account"."account_id" = ",
            },
            {
              "name": "accountId",
              "type": "param",
            },
            {
              "type": "text",
              "value": "
              /* </query_0> */",
            },
          ],
        }
      `);
   });

   test("insert() operator", async () => {
      const query = sql`
         INSERT INTO ${Account}
         ${insert(Account, "rows")}
      `;

      const result = await serializeQuery(query, "insertAccounts", "postgresql");

      const { ...stable } = result;
      expect(stable).toMatchInlineSnapshot(`
        {
          "authorization": [],
          "hash": "6ef677b228b5050065bee0c78d5ae770c856cb572d8213830947a657780355ca",
          "location": null,
          "name": "insertAccounts",
          "params": {
            "rows": {
              "isContext": false,
              "name": "rows",
            },
          },
          "row": null,
          "template": [
            {
              "type": "text",
              "value": " /* <query_0> */ 
                 INSERT INTO "main"."account"
                 ",
            },
            {
              "columns": {
                "accountId": ""account_id"",
                "createdAt": ""created_at"",
                "email": ""email"",
                "firstName": ""first_name"",
                "lastName": ""last_name"",
                "modifiedAt": ""modified_at"",
                "notes": ""notes"",
                "parentId": ""parent_id"",
                "status": ""status"",
              },
              "param": "rows",
              "type": "insert",
            },
            {
              "type": "text",
              "value": "
              /* </query_0> */",
            },
          ],
        }
      `);
   });

   test("insert.cols() + insert.values() split form", async () => {
      const query = sql`
         INSERT INTO ${Account}
         (${insert.cols(Account, "rows")})
         OUTPUT ${row(Account.as`inserted`.$$)}
         VALUES ${insert.values(Account, "rows")}
      `;

      const result = await serializeQuery(query, "insertMssql", "transactsql");

      const {  ...stable } = result;
      expect(stable).toMatchInlineSnapshot(`
        {
          "authorization": [],
          "hash": "9b686a7df08c43db04b407a294d002e9a87559d6b3930f4720f9e860fb6511a3",
          "location": null,
          "name": "insertMssql",
          "params": {
            "rows": {
              "isContext": false,
              "name": "rows",
            },
          },
          "row": {
            "createdAt": {
              "type": "Date",
            },
            "modifiedAt": {
              "type": "Date",
            },
          },
          "template": [
            {
              "type": "text",
              "value": " /* <query_0> */ 
                 INSERT INTO "main"."account"
                 (",
            },
            {
              "columns": {
                "accountId": ""account_id"",
                "createdAt": ""created_at"",
                "email": ""email"",
                "firstName": ""first_name"",
                "lastName": ""last_name"",
                "modifiedAt": ""modified_at"",
                "notes": ""notes"",
                "parentId": ""parent_id"",
                "status": ""status"",
              },
              "param": "rows",
              "type": "insertCols",
            },
            {
              "type": "text",
              "value": ")
                 OUTPUT "inserted"."account_id" as "accountId", "inserted"."status", "inserted"."email", "inserted"."first_name" as "firstName", "inserted"."last_name" as "lastName", "inserted"."notes", "inserted"."created_at" as "createdAt", "inserted"."modified_at" as "modifiedAt", "inserted"."parent_id" as "parentId"
                 VALUES ",
            },
            {
              "keys": [
                "accountId",
                "status",
                "email",
                "firstName",
                "lastName",
                "notes",
                "createdAt",
                "modifiedAt",
                "parentId",
              ],
              "param": "rows",
              "type": "insertValues",
            },
            {
              "type": "text",
              "value": "
              /* </query_0> */",
            },
          ],
        }
      `);
   });

   test("filter() operator", async () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         WHERE ${filterBy(Account, "filter")}
      `;

      const result = await serializeQuery(query, "filterAccounts", "postgresql");

      const { hash, location, ...stable } = result;
      expect(stable).toMatchInlineSnapshot(`
        {
          "authorization": [],
          "name": "filterAccounts",
          "params": {
            "filter": {
              "isContext": false,
              "name": "filter",
              "validation": {
                "columns": [
                  "accountId",
                  "status",
                  "email",
                  "firstName",
                  "lastName",
                  "notes",
                  "createdAt",
                  "modifiedAt",
                  "parentId",
                ],
                "operators": [
                  "equal",
                  "not",
                  "greaterThan",
                  "greaterOrEqual",
                  "lowerThan",
                  "lowerOrEqual",
                  "between",
                  "in",
                  "notIn",
                  "like",
                  "notLike",
                  "isNull",
                  "isNotNull",
                ],
                "type": "filter",
              },
            },
          },
          "row": {
            "createdAt": {
              "type": "Date",
            },
            "modifiedAt": {
              "type": "Date",
            },
          },
          "template": [
            {
              "type": "text",
              "value": " /* <query_0> */ 
                 SELECT "a_1"."account_id" as "accountId", "a_1"."status", "a_1"."email", "a_1"."first_name" as "firstName", "a_1"."last_name" as "lastName", "a_1"."notes", "a_1"."created_at" as "createdAt", "a_1"."modified_at" as "modifiedAt", "a_1"."parent_id" as "parentId"
                 FROM "main"."account" as "a_1"
                 WHERE ",
            },
            {
              "columns": {
                "accountId": ""a_1"."account_id"",
                "createdAt": ""a_1"."created_at"",
                "email": ""a_1"."email"",
                "firstName": ""a_1"."first_name"",
                "lastName": ""a_1"."last_name"",
                "modifiedAt": ""a_1"."modified_at"",
                "notes": ""a_1"."notes"",
                "parentId": ""a_1"."parent_id"",
                "status": ""a_1"."status"",
              },
              "param": "filter",
              "type": "filter",
            },
            {
              "type": "text",
              "value": "
              /* </query_0> */",
            },
          ],
        }
      `);
   });

   test("orderBy() operator", async () => {
      const query = sql`
         SELECT ${row(Account.$$)}
         FROM ${Account}
         ${orderBy(Account, "sort")}
      `;

      const result = await serializeQuery(query, "orderedAccounts", "postgresql");

      const { ...stable } = result;
      expect(stable).toMatchInlineSnapshot(`
        {
          "authorization": [],
          "hash": "f6ea06ad30c72924eb6a5bc6a63e3b875407621765edac202ed68e0a15c92faf",
          "location": null,
          "name": "orderedAccounts",
          "params": {
            "sort": {
              "isContext": false,
              "name": "sort",
            },
          },
          "row": {
            "createdAt": {
              "type": "Date",
            },
            "modifiedAt": {
              "type": "Date",
            },
          },
          "template": [
            {
              "type": "text",
              "value": " /* <query_0> */ 
                 SELECT "a_1"."account_id" as "accountId", "a_1"."status", "a_1"."email", "a_1"."first_name" as "firstName", "a_1"."last_name" as "lastName", "a_1"."notes", "a_1"."created_at" as "createdAt", "a_1"."modified_at" as "modifiedAt", "a_1"."parent_id" as "parentId"
                 FROM "main"."account" as "a_1"
                 ",
            },
            {
              "columns": {
                "accountId": ""a_1"."account_id"",
                "createdAt": ""a_1"."created_at"",
                "email": ""a_1"."email"",
                "firstName": ""a_1"."first_name"",
                "lastName": ""a_1"."last_name"",
                "modifiedAt": ""a_1"."modified_at"",
                "notes": ""a_1"."notes"",
                "parentId": ""a_1"."parent_id"",
                "status": ""a_1"."status"",
              },
              "param": "sort",
              "type": "orderBy",
            },
            {
              "type": "text",
              "value": "
              /* </query_0> */",
            },
          ],
        }
      `);
   });

   test("hash is stable for the same query", async () => {
      const q1 = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${param<{ email: string }>("email")}`;
      const q2 = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${param<{ email: string }>("email")}`;

      const r1 = await serializeQuery(q1, "q1", "postgresql");
      const r2 = await serializeQuery(q2, "q2", "postgresql");

      expect(r1.hash).toBe(r2.hash);
   });
});
