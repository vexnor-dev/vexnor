import { describe, expect, test } from "vitest";
import { excluded, sql } from "vexnor";
import "@vexnor/postgres";
import { Account } from "./codegen/vexnor_dev.schema.js";
import { pool } from "./postgres-pool.js";

describe.sequential("vexnor postgres table handler - upsert", () => {
   test("upsert: insert then update on conflict", async () => {
      const inserted = await Account.postgres.insertRows().one({
         db: pool,
         params: { rows: [{ email: "upsert@test.com", firstName: "Before", lastName: "Upsert" }] },
      });

      const upserted = await Account.postgres.upsert({ CONFLICT_ON: [Account.$accountId] }).one({
         db: pool,
         params: {
            rows: [{ accountId: inserted.accountId, email: "upsert@test.com", firstName: "After", lastName: "Upsert" }],
         },
      });

      expect(upserted.accountId).toBe(inserted.accountId);
      expect(upserted.firstName).toMatchInlineSnapshot(`"After"`);

      // cleanup
      await sql`delete from ${Account} where ${Account.$accountId} = ${inserted.accountId}`.postgres.run({ db: pool });
   });

   test("upsert: custom SET clause", async () => {
      const inserted = await Account.postgres.insertRows().one({
         db: pool,
         params: { rows: [{ email: "upsert-custom@test.com", firstName: "Before", lastName: "Custom" }] },
      });

      const upserted = await Account.postgres
         .upsert({
            CONFLICT_ON: [Account.$accountId],
            SET: sql`${Account.$firstName} = ${excluded(Account).$firstName}`,
         })
         .one({
            db: pool,
            params: {
               rows: [
                  {
                     accountId: inserted.accountId,
                     email: "upsert-custom@test.com",
                     firstName: "AfterCustom",
                     lastName: "Custom",
                  },
               ],
            },
         });

      expect(upserted.accountId).toBe(inserted.accountId);
      expect(upserted.firstName).toMatchInlineSnapshot(`"AfterCustom"`);

      // cleanup
      await sql`delete from ${Account} where ${Account.$accountId} = ${inserted.accountId}`.postgres.run({ db: pool });
   });
});
