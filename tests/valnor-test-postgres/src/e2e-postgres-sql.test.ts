import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { sql } from "valnor-postgres";
import { Account } from "./codegen/valnor_test.account-table.js";
import { randomUUID } from "node:crypto";
import { pool } from "./postgres-pool.js";
import { AccountStatusUdt } from "./codegen/valnor_test-enums.js";
import { row } from "valnor";

describe("valnor postgres sql tests", () => {
   afterAll(async () => {
      await pool.end();
   });

   beforeAll(async () => {
      await sql`
         delete
         from ${Account}
         where ${Account.$accountId} <> ${randomUUID()}
      `.run({ db: pool });
   });

   test("insert account", async () => {
      const account = await sql`
         insert into ${Account}
            ${Account.insertColsVals({
               status: AccountStatusUdt.CREATED,
               firstName: "John",
               lastName: "Doe",
               email: "john.doe@example.com",
            })}
            returning ${row(Account.$$all)}
      `.getOneRequired({ db: pool });

      expect(account).toEqual(
         expect.objectContaining({
            status: AccountStatusUdt.CREATED,
            firstName: "John",
            lastName: "Doe",
            email: "john.doe@example.com",
         }),
      );
   });
});
