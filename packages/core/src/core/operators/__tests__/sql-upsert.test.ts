import { describe, test, expect } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { upsert } from "#src/core/operators/sql-upsert.js";
import { Account } from "@test-models/vexnor_dev.schema.js";
import { serializeQuery } from "#src/core/serialize/serialize-query.js";

describe("SqlUpsert", () => {
   test("postgres: single row upsert", () => {
      const query = sql`INSERT INTO ${Account} ${upsert(Account, ["accountId"])} RETURNING ${row(Account.$$)}`;
      const { text, values } = query.getSql({
         params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "John", lastName: "Doe" }] },
         options: { dialect: "postgresql" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("account_id", "email", "first_name", "last_name")
        VALUES
          ($1, $2, $3, $4)
        ON CONFLICT ("account_id") DO UPDATE
        SET
          "email" = excluded."email",
          "first_name" = excluded."first_name",
          "last_name" = excluded."last_name"
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId" /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "id-1",
          "a@b.com",
          "John",
          "Doe",
        ]
      `);
   });

   test("postgres: multi row upsert", () => {
      const query = sql`INSERT INTO ${Account} ${upsert(Account, ["accountId"])} RETURNING ${row(Account.$$)}`;
      const { text, values } = query.getSql({
         params: {
            rows: [
               { accountId: "id-1", email: "a@b.com", firstName: "A", lastName: "AA" },
               { accountId: "id-2", email: "b@b.com", firstName: "B", lastName: "BB" },
            ],
         },
         options: { dialect: "postgresql" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("account_id", "email", "first_name", "last_name")
        VALUES
          ($1, $2, $3, $4),
          ($5, $6, $7, $8)
        ON CONFLICT ("account_id") DO UPDATE
        SET
          "email" = excluded."email",
          "first_name" = excluded."first_name",
          "last_name" = excluded."last_name"
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId" /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "id-1",
          "a@b.com",
          "A",
          "AA",
          "id-2",
          "b@b.com",
          "B",
          "BB",
        ]
      `);
   });

   test("mssql: single row upsert (MERGE)", () => {
      const query = sql`MERGE INTO ${Account} ${upsert(Account, ["accountId"])} OUTPUT inserted.*;`;
      const { text, values } = query.getSql({
         params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "John", lastName: "Doe" }] },
         options: { dialect: "transactsql" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        MERGE INTO
          "main"."account" using (
            VALUES
              (@param_0, @param_1, @param_2, @param_3)
          ) AS src ("account_id", "email", "first_name", "last_name") ON ("account"."account_id" = src."account_id")
        WHEN MATCHED THEN
        UPDATE SET
          "email" = src."email",
          "first_name" = src."first_name",
          "last_name" = src."last_name"
        WHEN NOT MATCHED THEN
        INSERT
          ("account_id", "email", "first_name", "last_name")
        VALUES
          (
            src."account_id",
            src."email",
            src."first_name",
            src."last_name"
          ) OUTPUT inserted.*;

        /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "id-1",
          "a@b.com",
          "John",
          "Doe",
        ]
      `);
   });

   test("mssql: multi row upsert (MERGE)", () => {
      const query = sql`MERGE INTO ${Account} ${upsert(Account, ["accountId"])} OUTPUT inserted.*;`;
      const { text, values } = query.getSql({
         params: {
            rows: [
               { accountId: "id-1", email: "a@b.com", firstName: "A", lastName: "AA" },
               { accountId: "id-2", email: "b@b.com", firstName: "B", lastName: "BB" },
            ],
         },
         options: { dialect: "transactsql" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        MERGE INTO
          "main"."account" using (
            VALUES
              (@param_0, @param_1, @param_2, @param_3),
              (@param_4, @param_5, @param_6, @param_7)
          ) AS src ("account_id", "email", "first_name", "last_name") ON ("account"."account_id" = src."account_id")
        WHEN MATCHED THEN
        UPDATE SET
          "email" = src."email",
          "first_name" = src."first_name",
          "last_name" = src."last_name"
        WHEN NOT MATCHED THEN
        INSERT
          ("account_id", "email", "first_name", "last_name")
        VALUES
          (
            src."account_id",
            src."email",
            src."first_name",
            src."last_name"
          ) OUTPUT inserted.*;

        /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "id-1",
          "a@b.com",
          "A",
          "AA",
          "id-2",
          "b@b.com",
          "B",
          "BB",
        ]
      `);
   });

   test("sqlite: single row upsert", () => {
      const query = sql`INSERT INTO ${Account} ${upsert(Account, ["accountId"])} RETURNING ${row(Account.$$)}`;
      const { text, values } = query.getSql({
         params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "John", lastName: "Doe" }] },
         options: { dialect: "sqlite" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("account_id", "email", "first_name", "last_name")
        VALUES
          (?, ?, ?, ?)
        ON CONFLICT ("account_id") DO UPDATE
        SET
          "email" = excluded."email",
          "first_name" = excluded."first_name",
          "last_name" = excluded."last_name"
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId" /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "id-1",
          "a@b.com",
          "John",
          "Doe",
        ]
      `);
   });

   test("serializes to UpsertNode when params are null", async () => {
      const query = sql`INSERT INTO ${Account} ${upsert(Account, ["accountId"])} RETURNING ${row(Account.$$)}`;
      const result = await serializeQuery(query, "xUpsert", "postgresql");
      const upsertNode = result.template.find((n) => n.type === "upsert");
      expect(upsertNode).toMatchInlineSnapshot(`
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
          "conflictKeys": [
            "accountId",
          ],
          "param": "rows",
          "tableName": ""account"",
          "type": "upsert",
        }
      `);
   });

   test("postgres: throws on non-primitive value", () => {
      const query = sql`INSERT INTO ${Account} ${upsert(Account, ["accountId"])} RETURNING ${row(Account.$$)}`;
      expect(() =>
         query.getSql({
            params: { rows: [{ accountId: "id-1", email: { nested: true }, firstName: "A", lastName: "B" }] },
            options: { dialect: "postgresql" },
         }),
      ).toThrow("Value is not a primitive");
   });

   test("mssql: throws on non-primitive value", () => {
      const query = sql`MERGE INTO ${Account} ${upsert(Account, ["accountId"])} OUTPUT inserted.*;`;
      expect(() =>
         query.getSql({
            params: { rows: [{ accountId: "id-1", email: { nested: true }, firstName: "A", lastName: "B" }] },
            options: { dialect: "transactsql" },
         }),
      ).toThrow("Value is not a primitive");
   });

   test("postgres: multi-row with multi-key conflict", () => {
      const query = sql`INSERT INTO ${Account} ${upsert(Account, ["accountId", "email"])} RETURNING ${row(Account.$$)}`;
      const { text } = query.getSql({
         params: {
            rows: [
               { accountId: "id-1", email: "a@b.com", firstName: "A", lastName: "AA" },
               { accountId: "id-2", email: "b@b.com", firstName: "B", lastName: "BB" },
            ],
         },
         options: { dialect: "postgresql" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        INSERT INTO
          "main"."account" ("account_id", "email", "first_name", "last_name")
        VALUES
          ($1, $2, $3, $4),
          ($5, $6, $7, $8)
        ON CONFLICT ("account_id", "email") DO UPDATE
        SET
          "first_name" = excluded."first_name",
          "last_name" = excluded."last_name"
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId" /* </query_0> */"
      `);
   });

   test("mssql: multi-key conflict", () => {
      const query = sql`MERGE INTO ${Account} ${upsert(Account, ["accountId", "email"])} OUTPUT inserted.*;`;
      const { text } = query.getSql({
         params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "A", lastName: "B" }] },
         options: { dialect: "transactsql" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        MERGE INTO
          "main"."account" using (
            VALUES
              (@param_0, @param_1, @param_2, @param_3)
          ) AS src ("account_id", "email", "first_name", "last_name") ON (
            "account"."account_id" = src."account_id"
            AND "account"."email" = src."email"
          )
        WHEN MATCHED THEN
        UPDATE SET
          "first_name" = src."first_name",
          "last_name" = src."last_name"
        WHEN NOT MATCHED THEN
        INSERT
          ("account_id", "email", "first_name", "last_name")
        VALUES
          (
            src."account_id",
            src."email",
            src."first_name",
            src."last_name"
          ) OUTPUT inserted.*;

        /* </query_0> */"
      `);
   });
});

describe("SqlUpsert — empty SET edge case", () => {
   test("postgres: all columns are conflict keys → emits DO NOTHING instead of empty SET", () => {
      const query = sql`INSERT INTO ${Account} ${upsert(Account, ["accountId", "email", "firstName", "lastName"])} RETURNING ${row(Account.$$)}`;
      const { text } = query.getSql({
         params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "A", lastName: "B" }] },
         options: { dialect: "postgresql" },
      });
      // When all cols are conflict keys, there's nothing to update — should emit DO NOTHING
      expect(text.toLowerCase()).toContain("do nothing");
   });

   test("mssql: all columns are conflict keys → omits WHEN MATCHED clause", () => {
      const query = sql`MERGE INTO ${Account} ${upsert(Account, ["accountId", "email", "firstName", "lastName"])} OUTPUT inserted.*;`;
      const { text } = query.getSql({
         params: { rows: [{ accountId: "id-1", email: "a@b.com", firstName: "A", lastName: "B" }] },
         options: { dialect: "transactsql" },
      });
      // When all cols are conflict keys, WHEN MATCHED should be omitted
      expect(text).not.toContain("when matched");
   });
});
