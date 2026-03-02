import { assertType, describe, expect, test } from "vitest";
import { sql } from "../../sql.js";
import { expand, param, row, SqlQuery } from "../index.js";
import { Account, IAccountSelect } from "../../__tests__/models/valnor_test.schema.js";

describe("SqlExpand", () => {
   describe("basic expand functionality", () => {
      test("expand with single Sql value", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>((params) => {
               return sql`${params?.ids?.[0]}`;
            })})
         `;

         const result = query.getSql({ params: { ids: ["id1", "id2", "id3"] } });

         expect(result.text).toMatchSnapshot();
         expect(result.values).toEqual(["id1"]);
      });

      test("expand with array of Sql values", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>((params) => {
               return params?.ids?.map((id) => sql`${id}`) ?? null;
            })})
         `;

         const result = query.getSql({ params: { ids: ["id1", "id2", "id3"] } });

         expect(result.text).toMatchSnapshot();
         expect(result.values).toEqual(["id1", "id2", "id3"]);
      });

      test("expand with empty array", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>((params) => {
               return params?.ids?.map((id) => sql`${id}`) ?? null;
            })})
         `;

         const result = query.getSql({ params: { ids: [] } });

         expect(result.text).toMatchSnapshot();
         expect(result.values).toEqual([]);
      });
   });

   describe("expand with param() references", () => {
      test("expand combined with param in same query", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>((params) => {
               return params?.ids?.map((id) => sql`${id}`) ?? null;
            })})
            AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         const result = query.getSql({ params: { ids: ["id1", "id2"], email: "test@example.com" } });

         expect(result.text).toMatchSnapshot();
         expect(result.values).toEqual(["id1", "id2", "test@example.com"]);
      });

      test("expand with param references inside handler", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${expand<{ conditions: Array<{ col: keyof typeof Account.cols; val: string }> }>((params) => {
               return params?.conditions?.map((cond) => sql`${Account.cols[cond.col]} = ${cond.val}`) ?? null;
            })}
         `;

         const result = query.getSql({
            params: {
               conditions: [
                  { col: "$email", val: "test@example.com" },
                  { col: "$firstName", val: "John" },
               ],
            },
         });

         expect(result.text).toMatchSnapshot();
         expect(result.values).toEqual(["test@example.com", "John"]);
      });
   });

   describe("expand in CRUD operations", () => {
      test("expand for INSERT columns", () => {
         const query = sql`
            INSERT INTO ${Account}
            (${expand<{ inserts: Array<{ email: string; firstName: string }> }>(() => {
               return [Account.$email, Account.$firstName];
            })})
            VALUES (${expand<{ inserts: Array<{ email: string; firstName: string }> }>((params) => {
               return (
                  params?.inserts?.map((insert) => {
                     const values = Object.values(insert);
                     return sql`(${values})`;
                  }) ?? null
               );
            })})
         `;

         const result = query.getSql({
            params: {
               inserts: [
                  { email: "test1@example.com", firstName: "John" },
                  { email: "test2@example.com", firstName: "Jane" },
               ],
            },
         });

         expect(result.text).toMatchSnapshot();
         expect(result.values).toEqual(["test1@example.com", "John", "test2@example.com", "Jane"]);
      });

      test("expand for UPDATE SET clause", () => {
         const query = sql`
            UPDATE ${Account}
            SET ${expand<{ updates: { email?: string; firstName?: string } }>((params) => {
               const updates = params?.updates;
               if (!updates) return null;
               const results = [];
               if (updates.email !== undefined) {
                  results.push(sql`${Account.$email} = ${updates.email}`);
               }
               if (updates.firstName !== undefined) {
                  results.push(sql`${Account.$firstName} = ${updates.firstName}`);
               }
               return results;
            })}
            WHERE ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
         `;

         const result = query.getSql({
            params: {
               updates: { email: "new@example.com", firstName: "UpdatedName" },
               accountId: "123",
            },
         });

         expect(result.text).toMatchSnapshot();
         expect(result.values).toEqual(["new@example.com", "UpdatedName", "123"]);
      });
   });

   describe("expand in nested queries", () => {
      test("expand in subquery (1 level)", () => {
         const subquery = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>((params) => {
               return params?.ids?.map((id) => sql`${id}`) ?? null;
            })})
         `;

         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${subquery})
         `;

         const result = query.getSql({ params: { ids: ["id1", "id2", "id3"] } });

         expect(result.text).toMatchSnapshot();
         expect(result.values).toEqual(["id1", "id2", "id3"]);
      });

      test("expand in nested subqueries (2 levels)", () => {
         const innerQuery = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$status} IN (${expand<{ statuses: string[] }>((params) => {
               return params?.statuses?.map((status) => sql`${status}`) ?? null;
            })})
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
            params: {
               statuses: ["CREATED", "CONFIRMED"],
               email: "test@example.com",
            },
         });

         expect(result.text).toMatchSnapshot();
         expect(result.values).toEqual(["CREATED", "CONFIRMED", "test@example.com"]);
      });

      test("expand in deeply nested subqueries (3 levels)", () => {
         const level3Query = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>((params) => {
               return params?.ids?.map((id) => sql`${id}`) ?? null;
            })})
         `;

         const level2Query = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${level3Query})
            AND ${Account.$status} IN (${expand<{ statuses: string[] }>((params) => {
               return params?.statuses?.map((status) => sql`${status}`) ?? null;
            })})
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
            params: {
               ids: ["id1", "id2"],
               statuses: ["CREATED", "CONFIRMED"],
               email: "test@example.com",
            },
         });

         expect(result.text).toMatchSnapshot();
         expect(result.values).toEqual(["id1", "id2", "CREATED", "CONFIRMED", "test@example.com"]);
      });
   });

   describe("expand with multiple expand calls", () => {
      test("multiple expand in same query", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>((params) => {
               return params?.ids?.map((id) => sql`${id}`) ?? null;
            })})
            AND ${Account.$status} IN (${expand<{ statuses: string[] }>((params) => {
               return params?.statuses?.map((status) => sql`${status}`) ?? null;
            })})
         `;

         const result = query.getSql({
            params: {
               ids: ["id1", "id2"],
               statuses: ["CREATED", "CONFIRMED"],
            },
         });

         expect(result.text).toMatchSnapshot();
         expect(result.values).toEqual(["id1", "id2", "CREATED", "CONFIRMED"]);
      });

      test("multiple expand with param references", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>((params) => {
               return params?.ids?.map((id) => sql`${id}`) ?? null;
            })})
            AND ${Account.$email} = ${param<{ email: string }>("email")}
            AND ${Account.$status} IN (${expand<{ statuses: string[] }>((params) => {
               return params?.statuses?.map((status) => sql`${status}`) ?? null;
            })})
            AND ${Account.$firstName} = ${param<{ firstName: string }>("firstName")}
         `;

         const result = query.getSql({
            params: {
               ids: ["id1", "id2"],
               email: "test@example.com",
               statuses: ["CREATED"],
               firstName: "John",
            },
         });

         expect(result.text).toMatchSnapshot();
         expect(result.values).toEqual(["id1", "id2", "test@example.com", "CREATED", "John"]);
      });
   });

   describe("expand type inference", () => {
      test("expand params type is inferred correctly", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>((params) => {
               assertType<Partial<{ ids: string[] }> | undefined>(params);
               return params?.ids?.map((id) => sql`${id}`) ?? null;
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
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>((params) => {
               return params?.ids?.map((id) => sql`${id}`) ?? null;
            })})
            AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         assertType<SqlQuery<{ Row: IAccountSelect; Params: { ids: string[]; email: string } }>>(query);

         const result = query.getSql({
            params: { ids: ["id1", "id2"], email: "test@example.com" },
         });
         expect(result.values).toEqual(["id1", "id2", "test@example.com"]);
      });

      test("expand in subquery - params flow through", () => {
         const subquery = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>((params) => {
               return params?.ids?.map((id) => sql`${id}`) ?? null;
            })})
         `;

         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${subquery})
            AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         assertType<SqlQuery<{ Row: { accountId: string }; Params: { ids: string[] } }>>(subquery);
         assertType<SqlQuery<{ Row: IAccountSelect; Params: { ids: string[]; email: string } }>>(query);

         const result = query.getSql({
            params: { ids: ["id1", "id2"], email: "test@example.com" },
         });
         expect(result.values).toEqual(["id1", "id2", "test@example.com"]);
      });

      test("expand in nested subqueries (2 levels) - params accumulate", () => {
         const innerQuery = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$status} IN (${expand<{ statuses: string[] }>((params) => {
               return params?.statuses?.map((status) => sql`${status}`) ?? null;
            })})
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
            params: {
               statuses: ["CREATED", "CONFIRMED"],
               email: "test@example.com",
               firstName: "John",
            },
         });
         expect(result.values).toEqual(["CREATED", "CONFIRMED", "test@example.com", "John"]);
      });

      test("expand in deeply nested subqueries (3 levels) - full params chain", () => {
         const level3Query = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>((params) => {
               return params?.ids?.map((id) => sql`${id}`) ?? null;
            })})
         `;

         const level2Query = sql`
            SELECT ${row(Account.$accountId)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${level3Query})
            AND ${Account.$status} IN (${expand<{ statuses: string[] }>((params) => {
               return params?.statuses?.map((status) => sql`${status}`) ?? null;
            })})
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
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>((params) => {
               return params?.ids?.map((id) => sql`${id}`) ?? null;
            })})
            AND ${Account.$status} IN (${expand<{ statuses: string[] }>((params) => {
               return params?.statuses?.map((status) => sql`${status}`) ?? null;
            })})
            AND ${Account.$email} = ${param<{ email: string }>("email")}
         `;

         assertType<SqlQuery<{ Row: IAccountSelect; Params: { ids: string[]; statuses: string[]; email: string } }>>(
            query,
         );

         const result = query.getSql({
            params: {
               ids: ["id1", "id2"],
               statuses: ["CREATED", "CONFIRMED"],
               email: "test@example.com",
            },
         });
         expect(result.values).toEqual(["id1", "id2", "CREATED", "CONFIRMED", "test@example.com"]);
      });
   });

   describe("expand error handling", () => {
      test("throws error when params not provided", () => {
         const query = sql`
            SELECT ${row(Account.$$)}
            FROM ${Account}
            WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>((params) => {
               return params?.ids?.map((id) => sql`${id}`) ?? null;
            })})
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
             "valnor_test"."account" AS "a_1"
           WHERE
             "a_1"."account_id" IN ()
             /* </query_0> */"
         `);
      });
   });
});
