import { describe, expect, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.schema.js";
import { insert } from "#src/core/operators/sql-insert-x.js";

describe("SqlInsert", () => {
   describe("combined form — insert()", () => {
      test("single row with multiple columns", () => {
         const query = sql`
            INSERT INTO ${Account}
            ${insert(Account, "rows")}
            RETURNING ${row(Account.$$)}
         `;

         const result = query.getSql({
            params: { rows: [{ email: "test@test.com", firstName: "John", lastName: "Doe" }] },
            options: { dialect: "sql", format: false },
         });

         expect(result.text).toMatchInlineSnapshot(`
           " /* <query_0> */ 
                       INSERT INTO "main"."account"
                       ("email", "first_name", "last_name") values (?, ?, ?)
                       RETURNING "account"."account_id" as "accountId", "account"."status", "account"."email", "account"."first_name" as "firstName", "account"."last_name" as "lastName", "account"."notes", "account"."created_at" as "createdAt", "account"."modified_at" as "modifiedAt", "account"."parent_id" as "parentId"
                    /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`
           [
             "test@test.com",
             "John",
             "Doe",
           ]
         `);
      });

      test("multiple rows with same keys", () => {
         const query = sql`
            INSERT INTO ${Account}
            ${insert(Account, "rows")}
         `;

         const result = query.getSql({
            params: {
               rows: [
                  {
                     email: "a@test.com",
                     firstName: "A",
                     lastName: "A",
                  },
                  {
                     email: "b@test.com",
                     firstName: "B",
                     lastName: "B",
                  },
                  {
                     email: "c@test.com",
                     firstName: "C",
                     lastName: "C",
                  },
               ],
            },
            options: { dialect: "sql", format: false },
         });

         expect(result.text).toMatchInlineSnapshot(`
           " /* <query_0> */ 
                       INSERT INTO "main"."account"
                       ("email", "first_name", "last_name") values (?, ?, ?), (?, ?, ?), (?, ?, ?)
                    /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`
           [
             "a@test.com",
             "A",
             "A",
             "b@test.com",
             "B",
             "B",
             "c@test.com",
             "C",
             "C",
           ]
         `);
      });

      test("columns follow table definition order, not input order", () => {
         const query = sql`
            INSERT INTO ${Account}
            ${insert(Account, "rows")}
         `;

         // lastName before email in input — should still emit in table order
         const result = query.getSql({
            params: { rows: [{ lastName: "Doe", email: "jane@test.com", firstName: "Jane" }] },
            options: { dialect: "sql", format: false },
         });

         expect(result.text).toMatchInlineSnapshot(`
           " /* <query_0> */ 
                       INSERT INTO "main"."account"
                       ("email", "first_name", "last_name") values (?, ?, ?)
                    /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`
           [
             "jane@test.com",
             "Jane",
             "Doe",
           ]
         `);
      });

      test("single column insert", () => {
         const query = sql`
            INSERT INTO ${Account}
            ${insert(Account, "rows")}
         `;

         const result = query.getSql({
            params: {
               rows: [
                  {
                     email: "only-email@test.com",
                     firstName: "A",
                     lastName: "AA",
                  },
               ],
            },
            options: { dialect: "sql", format: false },
         });

         expect(result.text).toMatchInlineSnapshot(`
           " /* <query_0> */ 
                       INSERT INTO "main"."account"
                       ("email", "first_name", "last_name") values (?, ?, ?)
                    /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`
           [
             "only-email@test.com",
             "A",
             "AA",
           ]
         `);
      });

      test("succeeds when all rows have the same keys", () => {
         const query = sql`
            INSERT INTO ${Account}
            ${insert(Account, "rows")}
         `;

         expect(() =>
            query.getSql({
               params: {
                  rows: [
                     { email: "a@test.com", firstName: "A", lastName: "AA" },
                     {
                        email: "b@test.com",
                        firstName: "B",
                        lastName: "BB",
                     },
                  ],
               },
               options: { dialect: "sql", format: false },
            }),
         ).not.toThrow();
      });

      test("succeeds when rows have identical columns", () => {
         const query = sql`
            INSERT INTO ${Account}
            ${insert(Account, "rows")}
         `;

         expect(() =>
            query.getSql({
               params: {
                  rows: [
                     {
                        email: "a@test.com",
                        firstName: "A",
                        lastName: "AA",
                     },
                     {
                        email: "b@test.com",
                        firstName: "B",
                        lastName: "BB",
                     },
                  ],
               },
               options: { dialect: "sql", format: false },
            }),
         ).not.toThrow();
      });

      test("throws on unknown column", () => {
         const query = sql`
            INSERT INTO ${Account}
            ${insert(Account, "rows")}
         `;

         expect(() =>
            query.getSql({
               // @ts-expect-error notAColumn not a column
               params: { rows: [{ notAColumn: "value" }] },
               options: { dialect: "sql", format: false },
            }),
         ).toThrow("does not exist in table");
      });

      test("throws on non-primitive value", () => {
         const query = sql`
            INSERT INTO ${Account}
            ${insert(Account, "rows")}
         `;

         expect(() =>
            query.getSql({
               // @ts-expect-error nested not a column
               params: { rows: [{ email: { nested: "object" } }] },
               options: { dialect: "sql", format: false },
            }),
         ).toThrow("not a primitive");
      });

      test("handles null values in rows", () => {
         const query = sql`
            INSERT INTO ${Account}
            ${insert(Account, "rows")}
         `;

         const result = query.getSql({
            params: {
               rows: [
                  {
                     email: "test@test.com",
                     notes: null,
                     firstName: "A",
                     lastName: "AA",
                  },
               ],
            },
            options: { dialect: "sql", format: false },
         });

         expect(result.text).toMatchInlineSnapshot(`
           " /* <query_0> */ 
                       INSERT INTO "main"."account"
                       ("email", "first_name", "last_name", "notes") values (?, ?, ?, ?)
                    /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`
           [
             "test@test.com",
             "A",
             "AA",
             null,
           ]
         `);
      });
   });

   describe("split form — insert.cols() + insert.values()", () => {
      test("insert.cols() emits column names only", () => {
         const query = sql`
            INSERT INTO ${Account}
            (${insert.cols(Account, "rows")})
            OUTPUT ${row(Account.as`inserted`.$$)}
            VALUES ${insert.values(Account, "rows")}
         `;

         const result = query.getSql({
            params: { rows: [{ email: "test@test.com", firstName: "John", lastName: "AA" }] },
            options: { dialect: "sql", format: false },
         });

         expect(result.text).toMatchInlineSnapshot(`
           " /* <query_0> */ 
                       INSERT INTO "main"."account"
                       ("email", "first_name", "last_name")
                       OUTPUT "inserted"."account_id" as "accountId", "inserted"."status", "inserted"."email", "inserted"."first_name" as "firstName", "inserted"."last_name" as "lastName", "inserted"."notes", "inserted"."created_at" as "createdAt", "inserted"."modified_at" as "modifiedAt", "inserted"."parent_id" as "parentId"
                       VALUES (?, ?, ?)
                    /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`
           [
             "test@test.com",
             "John",
             "AA",
           ]
         `);
      });

      test("insert.values() emits multiple tuples", () => {
         const query = sql`
            VALUES ${insert.values(Account, "rows")}
         `;

         const result = query.getSql({
            params: {
               rows: [
                  {
                     email: "a@test.com",
                     firstName: "A",
                     lastName: "AA",
                  },
                  {
                     email: "b@test.com",
                     firstName: "B",
                     lastName: "BB",
                  },
               ],
            },
            options: { dialect: "sql", format: false },
         });

         expect(result.text).toMatchInlineSnapshot(`
           " /* <query_0> */ 
                       VALUES (?, ?, ?), (?, ?, ?)
                    /* </query_0> */"
         `);
         expect(result.values).toMatchInlineSnapshot(`
           [
             "a@test.com",
             "A",
             "AA",
             "b@test.com",
             "B",
             "BB",
           ]
         `);
      });

      test("split form validates same as combined form", () => {
         const query = sql`
            (${insert.cols(Account, "rows")})
            VALUES ${insert.values(Account, "rows")}
         `;

         expect(() =>
            query.getSql({
               // @ts-expect-error notAColumn not allowed
               params: { rows: [{ notAColumn: "x" }] },
               options: { dialect: "sql", format: false },
            }),
         ).toThrow("does not exist in table");
      });
   });
});
