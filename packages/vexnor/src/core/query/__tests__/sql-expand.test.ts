import { assertType, describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { expand } from "#/core/query/sql-expand.js";
import { param } from "#/core/query/sql-param.js";
import { row } from "#/core/query/sql-select-row.js";
import { SqlQuery } from "#/core/query/sql-query.js";
import { Account, IAccountSelect } from "@test-models/vexnor_dev.schema.js";

describe("SqlExpand", () => {
   describe("basic expand functionality", () => {
      test("expand with single Sql value", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: null }, ({ ids }) => sql`${ids[0]}`)})
         `;

         const result = query.getSql({ params: { ids: ["id1", "id2", "id3"] } });

         expect(result.text).toMatchInlineSnapshot(`
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
           WHERE
             "a_1"."account_id" IN (/* <query_1> */ ? /* </query_1> */)
             /* </query_0> */"
         `);
         expect(result.values).toEqual(["id1"]);
      });

      test("expand with array of Sql values", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: null }, ({ ids }) =>
               ids.map((id) => sql`${id}`),
            )})
         `;

         const result = query.getSql({ params: { ids: ["id1", "id2", "id3"] } });

         expect(result.text).toMatchInlineSnapshot(`
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
           WHERE
             "a_1"."account_id" IN (
               /* <query_1> */ ? /* </query_1> */,
               /* <query_2> */ ? /* </query_2> */,
               /* <query_3> */ ? /* </query_3> */
             )
             /* </query_0> */"
         `);
         expect(result.values).toEqual(["id1", "id2", "id3"]);
      });

      test("expand with empty array", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: null }, ({ ids }) =>
               ids.map((id) => sql`${id}`),
            )})
         `;

         const result = query.getSql({ params: { ids: [] } });

         expect(result.text).toMatchInlineSnapshot(`
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
           WHERE
             "a_1"."account_id" IN ()
             /* </query_0> */"
         `);
         expect(result.values).toEqual([]);
      });
   });

   describe("expand with param() references", () => {
      test("expand combined with param in same query", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: null }, ({ ids }) =>
               ids.map((id) => sql`${id}`),
            )})
            AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         const result = query.getSql({ params: { ids: ["id1", "id2"], email: "test@example.com" } });

         expect(result.text).toMatchInlineSnapshot(`
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
           WHERE
             "a_1"."account_id" IN (
               /* <query_1> */ ? /* </query_1> */,
               /* <query_2> */ ? /* </query_2> */
             )
             AND "a_1"."email" = ?
             /* </query_0> */"
         `);
         expect(result.values).toEqual(["id1", "id2", "test@example.com"]);
      });

      test("expand with param references inside handler", () => {
         type Conditions = Array<{ col: keyof typeof Account.cols; val: string }>;
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${expand<{ conditions: Conditions }>({ conditions: null }, ({ conditions }) =>
               conditions.map((cond) => sql`${Account.cols[cond.col]} = ${cond.val}`),
            )}
         `;

         const result = query.getSql({
            params: {
               conditions: [
                  { col: "$email", val: "test@example.com" },
                  { col: "$firstName", val: "John" },
               ],
            },
         });

         expect(result.text).toMatchInlineSnapshot(`
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
           WHERE
             /* <query_1> */ "a_1"."email" = ? /* </query_1> */,
             /* <query_2> */ "a_1"."first_name" = ? /* </query_2> */
             /* </query_0> */"
         `);
         expect(result.values).toEqual(["test@example.com", "John"]);
      });
   });

   describe("expand in CRUD operations", () => {
      test("expand for INSERT columns", () => {
         type Inserts = Array<{ email: string; firstName: string }>;
         const query = sql`
            INSERT INTO ${Account}
            (${expand<{ inserts: Inserts }>({ inserts: null }, () => [Account.$email, Account.$firstName])})
            VALUES (${expand<{ inserts: Inserts }>({ inserts: null }, ({ inserts }) =>
               inserts.map((insert) => sql`(${Object.values(insert)})`),
            )})
         `;

         const result = query.getSql({
            params: {
               inserts: [
                  { email: "test1@example.com", firstName: "John" },
                  { email: "test2@example.com", firstName: "Jane" },
               ],
            },
         });

         expect(result.text).toMatchInlineSnapshot(`
           "/* <query_0> */
           INSERT INTO
             "main"."account" ("email", "first_name")
           VALUES
             (
               /* <query_1> */ (?, ?) /* </query_1> */,
               /* <query_2> */ (?, ?) /* </query_2> */
             )
             /* </query_0> */"
         `);
         expect(result.values).toEqual(["test1@example.com", "John", "test2@example.com", "Jane"]);
      });

      test("expand for UPDATE SET clause", () => {
         const query = sql`
            UPDATE ${Account}
            SET ${expand<{ email: string; firstName: string }>(
               { email: null, firstName: null },
               ({ email, firstName }) => [sql`${Account.$email} = ${email}`, sql`${Account.$firstName} = ${firstName}`],
            )}
            WHERE ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
         `;

         const result = query.getSql({
            params: { email: "new@example.com", firstName: "UpdatedName", accountId: "123" },
         });

         expect(result.text).toMatchInlineSnapshot(`
           "/* <query_0> */
           UPDATE "main"."account"
           SET
             /* <query_1> */ "email" = ? /* </query_1> */,
             /* <query_2> */ "first_name" = ? /* </query_2> */
           WHERE
             "account"."account_id" = ?
             /* </query_0> */"
         `);
         expect(result.values).toEqual(["new@example.com", "UpdatedName", "123"]);
      });
   });

   describe("expand in nested queries", () => {
      test("expand in subquery (1 level)", () => {
         const subquery = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: null }, ({ ids }) =>
               ids.map((id) => sql`${id}`),
            )})
         `;

         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${subquery})
         `;

         const result = query.getSql({ params: { ids: ["id1", "id2", "id3"] } });

         expect(result.text).toMatchInlineSnapshot(`
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
           WHERE
             "a_1"."account_id" IN (
               /* <query_1> */
               SELECT
                 "a_2"."account_id" AS "accountId"
               FROM
                 "main"."account" AS "a_2"
               WHERE
                 "a_2"."account_id" IN (
                   /* <query_2> */ ? /* </query_2> */,
                   /* <query_3> */ ? /* </query_3> */,
                   /* <query_4> */ ? /* </query_4> */
                 )
                 /* </query_1> */
             )
             /* </query_0> */"
         `);
         expect(result.values).toEqual(["id1", "id2", "id3"]);
      });

      test("expand in nested subqueries (2 levels)", () => {
         const innerQuery = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$status} IN (${expand<{ statuses: string[] }>({ statuses: null }, ({ statuses }) =>
               statuses.map((status) => sql`${status}`),
            )})
         `;

         const middleQuery = sql`
            SELECT ${row(Account.$accountId, Account.$email)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${innerQuery})
            AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${middleQuery})
         `;

         const result = query.getSql({
            params: { statuses: ["CREATED", "CONFIRMED"], email: "test@example.com" },
         });

         expect(result.text).toMatchInlineSnapshot(`
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
           WHERE
             "a_1"."account_id" IN (
               /* <query_1> */
               SELECT
                 "a_2"."account_id" AS "accountId",
                 "a_2"."email"
               FROM
                 "main"."account" AS "a_2"
               WHERE
                 "a_2"."account_id" IN (
                   /* <query_2> */
                   SELECT
                     "a_3"."account_id" AS "accountId"
                   FROM
                     "main"."account" AS "a_3"
                   WHERE
                     "a_3"."status" IN (
                       /* <query_3> */ ? /* </query_3> */,
                       /* <query_4> */ ? /* </query_4> */
                     )
                     /* </query_2> */
                 )
                 AND "a_2"."email" = ?
                 /* </query_1> */
             )
             /* </query_0> */"
         `);
         expect(result.values).toEqual(["CREATED", "CONFIRMED", "test@example.com"]);
      });

      test("expand in deeply nested subqueries (3 levels)", () => {
         const level3Query = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: null }, ({ ids }) =>
               ids.map((id) => sql`${id}`),
            )})
         `;

         const level2Query = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${level3Query})
            AND ${Account.$status} IN (${expand<{ statuses: string[] }>({ statuses: null }, ({ statuses }) =>
               statuses.map((status) => sql`${status}`),
            )})
         `;

         const level1Query = sql`
            SELECT ${row(Account.$accountId, Account.$email)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${level2Query})
            AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         const rootQuery = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${level1Query})
         `;

         const result = rootQuery.getSql({
            params: { ids: ["id1", "id2"], statuses: ["CREATED", "CONFIRMED"], email: "test@example.com" },
         });

         expect(result.text).toMatchInlineSnapshot(`
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
           WHERE
             "a_1"."account_id" IN (
               /* <query_1> */
               SELECT
                 "a_2"."account_id" AS "accountId",
                 "a_2"."email"
               FROM
                 "main"."account" AS "a_2"
               WHERE
                 "a_2"."account_id" IN (
                   /* <query_2> */
                   SELECT
                     "a_3"."account_id" AS "accountId"
                   FROM
                     "main"."account" AS "a_3"
                   WHERE
                     "a_3"."account_id" IN (
                       /* <query_3> */
                       SELECT
                         "a_4"."account_id" AS "accountId"
                       FROM
                         "main"."account" AS "a_4"
                       WHERE
                         "a_4"."account_id" IN (
                           /* <query_4> */ ? /* </query_4> */,
                           /* <query_5> */ ? /* </query_5> */
                         )
                         /* </query_3> */
                     )
                     AND "a_3"."status" IN (
                       /* <query_6> */ ? /* </query_6> */,
                       /* <query_7> */ ? /* </query_7> */
                     )
                     /* </query_2> */
                 )
                 AND "a_2"."email" = ?
                 /* </query_1> */
             )
             /* </query_0> */"
         `);
         expect(result.values).toEqual(["id1", "id2", "CREATED", "CONFIRMED", "test@example.com"]);
      });
   });

   describe("expand with multiple expand calls", () => {
      test("multiple expand in same query", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: null }, ({ ids }) =>
               ids.map((id) => sql`${id}`),
            )})
            AND ${Account.$status} IN (${expand<{ statuses: string[] }>({ statuses: null }, ({ statuses }) =>
               statuses.map((status) => sql`${status}`),
            )})
         `;

         const result = query.getSql({ params: { ids: ["id1", "id2"], statuses: ["CREATED", "CONFIRMED"] } });

         expect(result.text).toMatchInlineSnapshot(`
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
           WHERE
             "a_1"."account_id" IN (
               /* <query_1> */ ? /* </query_1> */,
               /* <query_2> */ ? /* </query_2> */
             )
             AND "a_1"."status" IN (
               /* <query_3> */ ? /* </query_3> */,
               /* <query_4> */ ? /* </query_4> */
             )
             /* </query_0> */"
         `);
         expect(result.values).toEqual(["id1", "id2", "CREATED", "CONFIRMED"]);
      });

      test("multiple expand with param references", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: null }, ({ ids }) =>
               ids.map((id) => sql`${id}`),
            )})
            AND ${Account.$email} = ${param<{ email: string }>("email")}
            AND ${Account.$status} IN (${expand<{ statuses: string[] }>({ statuses: null }, ({ statuses }) =>
               statuses.map((status) => sql`${status}`),
            )})
            AND ${Account.$firstName} = ${param<{ firstName: string }>("firstName")}
         `;

         const result = query.getSql({
            params: { ids: ["id1", "id2"], email: "test@example.com", statuses: ["CREATED"], firstName: "John" },
         });

         expect(result.text).toMatchInlineSnapshot(`
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
           WHERE
             "a_1"."account_id" IN (
               /* <query_1> */ ? /* </query_1> */,
               /* <query_2> */ ? /* </query_2> */
             )
             AND "a_1"."email" = ?
             AND "a_1"."status" IN (/* <query_3> */ ? /* </query_3> */)
             AND "a_1"."first_name" = ?
             /* </query_0> */"
         `);
         expect(result.values).toEqual(["id1", "id2", "test@example.com", "CREATED", "John"]);
      });
   });

   describe("expand type inference", () => {
      test("expand params type is inferred from generic", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: null }, ({ ids }) => {
               assertType<string[]>(ids);
               return ids.map((id) => sql`${id}`);
            })})
         `;

         assertType<SqlQuery<{ Row: IAccountSelect; Params: { ids: string[] } }>>(query);

         const result = query.getSql({ params: { ids: ["id1"] } });
         expect(result.values).toEqual(["id1"]);
      });

      test("expand with param() - combined params type inference", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: null }, ({ ids }) =>
               ids.map((id) => sql`${id}`),
            )})
            AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         assertType<SqlQuery<{ Row: IAccountSelect; Params: { ids: string[]; email: string } }>>(query);

         const result = query.getSql({ params: { ids: ["id1", "id2"], email: "test@example.com" } });
         expect(result.values).toEqual(["id1", "id2", "test@example.com"]);
      });

      test("expand in subquery - params flow through", () => {
         const subquery = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: null }, ({ ids }) =>
               ids.map((id) => sql`${id}`),
            )})
         `;

         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${subquery})
            AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         assertType<SqlQuery<{ Row: { accountId: string }; Params: { ids: string[] } }>>(subquery);
         assertType<SqlQuery<{ Row: IAccountSelect; Params: { ids: string[]; email: string } }>>(query);

         const result = query.getSql({ params: { ids: ["id1", "id2"], email: "test@example.com" } });
         expect(result.values).toEqual(["id1", "id2", "test@example.com"]);
      });

      test("expand in nested subqueries (2 levels) - params accumulate", () => {
         const innerQuery = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$status} IN (${expand<{ statuses: string[] }>({ statuses: null }, ({ statuses }) =>
               statuses.map((status) => sql`${status}`),
            )})
         `;

         const middleQuery = sql`
            SELECT ${row(Account.$accountId, Account.$email)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${innerQuery})
            AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${middleQuery})
            AND ${Account.$firstName} = ${param<{ firstName: string }>("firstName")}
         `;

         assertType<SqlQuery<{ Row: { accountId: string }; Params: { statuses: string[] } }>>(innerQuery);
         assertType<
            SqlQuery<{ Row: { accountId: string; email: string }; Params: { statuses: string[]; email: string } }>
         >(middleQuery);
         assertType<
            SqlQuery<{ Row: IAccountSelect; Params: { statuses: string[]; email: string; firstName: string } }>
         >(query);

         const result = query.getSql({
            params: { statuses: ["CREATED", "CONFIRMED"], email: "test@example.com", firstName: "John" },
         });
         expect(result.values).toEqual(["CREATED", "CONFIRMED", "test@example.com", "John"]);
      });

      test("expand in deeply nested subqueries (3 levels) - full params chain", () => {
         const level3Query = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: null }, ({ ids }) =>
               ids.map((id) => sql`${id}`),
            )})
         `;

         const level2Query = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${level3Query})
            AND ${Account.$status} IN (${expand<{ statuses: string[] }>({ statuses: null }, ({ statuses }) =>
               statuses.map((status) => sql`${status}`),
            )})
         `;

         const level1Query = sql`
            SELECT ${row(Account.$accountId, Account.$email)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${level2Query})
            AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         const rootQuery = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${level1Query})
            AND ${Account.$firstName} = ${param<{ firstName: string }>("firstName")}
         `;

         assertType<SqlQuery<{ Row: { accountId: string }; Params: { ids: string[] } }>>(level3Query);
         assertType<SqlQuery<{ Row: { accountId: string }; Params: { ids: string[]; statuses: string[] } }>>(
            level2Query,
         );
         assertType<
            SqlQuery<{
               Row: { accountId: string; email: string };
               Params: { ids: string[]; statuses: string[]; email: string };
            }>
         >(level1Query);
         assertType<
            SqlQuery<{
               Row: IAccountSelect;
               Params: { ids: string[]; statuses: string[]; email: string; firstName: string };
            }>
         >(rootQuery);

         const result = rootQuery.getSql({
            params: {
               ids: ["id1", "id2"],
               statuses: ["CREATED", "CONFIRMED"],
               email: "test@example.com",
               firstName: "John",
            },
         });
         expect(result.values).toEqual(["id1", "id2", "CREATED", "CONFIRMED", "test@example.com", "John"]);
      });

      test("multiple expand calls - params merge correctly", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: null }, ({ ids }) =>
               ids.map((id) => sql`${id}`),
            )})
            AND ${Account.$status} IN (${expand<{ statuses: string[] }>({ statuses: null }, ({ statuses }) =>
               statuses.map((status) => sql`${status}`),
            )})
            AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         assertType<SqlQuery<{ Row: IAccountSelect; Params: { ids: string[]; statuses: string[]; email: string } }>>(
            query,
         );

         const result = query.getSql({
            params: { ids: ["id1", "id2"], statuses: ["CREATED", "CONFIRMED"], email: "test@example.com" },
         });
         expect(result.values).toEqual(["id1", "id2", "CREATED", "CONFIRMED", "test@example.com"]);
      });
   });

   describe("expand validation", () => {
      test("validates params before invoking handler", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>({ ids: { minLength: 1 } }, ({ ids }) =>
               ids.map((id) => sql`${id}`),
            )})
         `;

         expect(() => query.getSql({ params: { ids: [] } })).toThrow("Invalid param 'ids'");
         expect(() => query.getSql({ params: { ids: ["id1"] } })).not.toThrow();
      });

      test("validates values whitelist", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            ORDER BY ${expand<{ sort: string }>({ sort: { values: ["email", "createdAt"] } }, ({ sort }) => [
               sql`${sort}`,
            ])}
         `;

         expect(() => query.getSql({ params: { sort: "invalid" } })).toThrow("Invalid param 'sort'");
         expect(() => query.getSql({ params: { sort: "email" } })).not.toThrow();
      });
   });

   describe("expand default values", () => {
      test("undefined param uses declared default", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            ORDER BY ${expand<{ sort?: string }>({ sort: { default: "createdAt" } }, ({ sort }) => [sql`${sort}`])}
         `;

         const { text, values } = query.getSql({ params: {} });
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
           ORDER BY
             /* <query_1> */ ? /* </query_1> */
             /* </query_0> */"
         `);
         expect(values).toEqual(["createdAt"]);
      });

      test("invalid param with default falls back silently", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            ORDER BY ${expand<{ sort: string }>(
               { sort: { values: ["email", "createdAt"], default: "createdAt" } },
               ({ sort }) => [sql`${sort}`],
            )}
         `;

         const { values, text } = query.getSql({ params: { sort: "invalid" } });
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
           ORDER BY
             /* <query_1> */ ? /* </query_1> */
             /* </query_0> */"
         `);
         expect(values).toEqual(["createdAt"]);
      });

      test("invalid param without default throws", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            ORDER BY ${expand<{ sort: string }>({ sort: { values: ["email", "createdAt"] } }, ({ sort }) => [
               sql`${sort}`,
            ])}
         `;

         expect(() => query.getSql({ params: { sort: "invalid" } })).toThrow("Invalid param 'sort'");
      });
   });

   describe("expand error handling", () => {
      test("expands to empty when params not provided", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>(
               { ids: null },
               ({ ids }) => ids?.map((id) => sql`${id}`) ?? null,
            )})
         `;

         // @ts-expect-error - Testing runtime validation
         expect(query.getSql({}).text).toMatchInlineSnapshot(`
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
           WHERE
             "a_1"."account_id" IN ()
             /* </query_0> */"
         `);
      });
   });
});
