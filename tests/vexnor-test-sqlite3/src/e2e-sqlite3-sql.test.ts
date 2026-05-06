import { afterAll, describe, expect, test } from "vitest";
import { sql } from "vexnor-sqlite3";
import { Account } from "./codegen/main.account-table.js";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { SQLITE_PATH } from "./config.js";
import { row } from "vexnor";

describe("vexnor postgres sql tests", () => {
   const db = new Database(SQLITE_PATH);

   afterAll(async () => {
      db.close();
   });

   test("insert account", async () => {
      const accountId = randomUUID();
      await sql`
         insert into ${Account}
            ${Account.insertColsVals({
               accountId,
               status: "created",
               firstName: "John",
               lastName: "Doe",
               email: "john.doe@example.com",
            })}
      `.run({ db });

      const account = await sql`
        select ${row(Account.$$)}
        from ${Account}
        where ${Account.$accountId} = ${accountId}`.one({ db });

      expect(account).toMatchObject({
         accountId,
         status: "created",
         firstName: "John",
         lastName: "Doe",
         email: "john.doe@example.com",
      });
   });
});
