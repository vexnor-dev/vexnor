import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { sql } from "valnor-postgres";
import { Account, IAccountSelect } from "./codegen/valnor_test.account-table.js";
import { randomUUID } from "node:crypto";
import { pool } from "./postgres-pool.js";
import { AccountStatusUdt } from "./codegen/valnor_test-enums.js";

describe("valnor postgres sql tests", () => {
   afterAll(async () => {
      await pool.end();
   });

   beforeAll(async () => {
      await sql<object>`
         delete
         from ${Account}
         where ${Account.accountId} <> ${randomUUID()}
      `.run({ db: pool });
   });

   test("insert account", async () => {
      const account = await sql<IAccountSelect>`
         insert into ${Account}
            ${Account.$$values({
               status: AccountStatusUdt.CREATED,
               firstName: "John",
               lastName: "Doe",
               email: "john.doe@example.com",
            })}
            returning ${Account.$$all}
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
