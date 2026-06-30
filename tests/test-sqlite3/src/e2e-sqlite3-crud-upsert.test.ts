import { describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";

import "@vexnor/sqlite3";
import { Account, IAccountInsert } from "./codegen/main.account-table.js";
import { db } from "./config.js";

describe.sequential("vexnor sqlite3 CRUD - upsert", () => {
   test("upsert: insert then update on conflict", async () => {
      const insert: IAccountInsert = {
         accountId: randomUUID(),
         email: `upsert-${randomUUID()}@example.com`,
         firstName: "Before",
         lastName: "Upsert",
      };

      const inserted = await Account.sqlite.insertRows().one({ db, params: { rows: [insert] } });

      const upserted = await Account.sqlite.upsert({ CONFLICT_ON: [Account.$accountId] }).one({
         db,
         params: {
            rows: [{ accountId: inserted.accountId, email: inserted.email, firstName: "After", lastName: "Upsert" }],
         },
      });

      expect(upserted.accountId).toBe(inserted.accountId);
      expect(upserted.firstName).toBe("After");
   });

   test("upsert: custom SET clause", async () => {
      const insert: IAccountInsert = {
         accountId: randomUUID(),
         email: `upsert-custom-${randomUUID()}@example.com`,
         firstName: "Before",
         lastName: "Custom",
      };

      const inserted = await Account.sqlite.insertRows().one({ db, params: { rows: [insert] } });

      const upserted = await Account.sqlite
         .upsert({
            CONFLICT_ON: [Account.$accountId],
         })
         .one({
            db,
            params: {
               rows: [
                  {
                     accountId: inserted.accountId,
                     email: inserted.email,
                     firstName: "AfterCustom",
                     lastName: "Custom",
                  },
               ],
            },
         });

      expect(upserted.accountId).toBe(inserted.accountId);
      expect(upserted.firstName).toBe("AfterCustom");
   });
});
