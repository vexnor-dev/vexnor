import { describe, expect, test } from "vitest";
import { sql } from "vexnor";
import "vexnor-mssql";
import { Account } from "./codegen/vexnor_dev.schema.js";
import { pool } from "./mssql-pool.js";

describe.sequential("vexnor mssql table handler - upsert", () => {
   test("upsert: insert then update on conflict", async () => {
      const inserted = await Account.mssql.insertRows().one({
         db: pool.request(),
         params: { rows: [{ email: "upsert@test.com", firstName: "Before", lastName: "Upsert" }] },
      });

      const upserted = await Account.mssql.upsert({ MERGE_ON: [Account.$accountId] }).one({
         db: pool.request(),
         params: {
            rows: [{ accountId: inserted.accountId, email: "upsert@test.com", firstName: "After", lastName: "Upsert" }],
         },
      });

      expect(upserted.accountId).toBe(inserted.accountId);
      expect(upserted.firstName).toMatchInlineSnapshot(`"After"`);

      // cleanup
      await sql`delete from ${Account} where ${Account.$accountId} = ${inserted.accountId}`.mssql.run({ db: pool.request() });
   });

   test("upsert: insert new row when no match", async () => {
      const newId = crypto.randomUUID();

      const upserted = await Account.mssql.upsert({ MERGE_ON: [Account.$accountId] }).one({
         db: pool.request(),
         params: {
            rows: [{ accountId: newId, email: "upsert-new@test.com", firstName: "New", lastName: "Row" }],
         },
      });

      expect(upserted.accountId.toLowerCase()).toBe(newId);
      expect(upserted.firstName).toMatchInlineSnapshot(`"New"`);

      // cleanup
      await sql`delete from ${Account} where ${Account.$accountId} = ${newId}`.mssql.run({ db: pool.request() });
   });
});
