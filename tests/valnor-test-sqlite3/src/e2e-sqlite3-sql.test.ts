import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { sql } from "valnor-sqlite3";
import { Account, IAccountSelect } from "./codegen/main.account-table.js";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { SQLITE_PATH } from "./config.js";

describe("valnor postgres sql tests", () => {
   const db = new Database(SQLITE_PATH);

   beforeAll(async () => {
      await sql<object>`
         delete
         from ${Account}
         where ${Account.$accountId} <> ${randomUUID()}
      `.run({ db: db });
   });

   afterAll(async () => {
      db.close();
   });

   test("insert account", async () => {
      const accountId = randomUUID();
      await sql`
         insert into ${Account}
            ${Account.$$values({
               accountId,
               status: "created",
               firstName: "John",
               lastName: "Doe",
               email: "john.doe@example.com",
            })}
      `.run({ db });

      const account = await sql<IAccountSelect>`
        select ${Account.$$all}
        from ${Account}
        where ${Account.$accountId} = ${accountId}`.getOneRequired({ db });

      expect(account).toEqual(
         expect.objectContaining({
            accountId,
            status: "created",
            firstName: "John",
            lastName: "Doe",
            email: "john.doe@example.com",
         }),
      );
   });
});
