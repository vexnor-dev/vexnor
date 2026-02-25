import { describe, expect, test } from "vitest";
import { Account } from "./codegen/valnor_test.account-table.js";
import { pool } from "./postgres-pool.js";
import { AccountStatusUdt } from "./codegen/valnor_test-enums.js";
import { row } from "valnor";
import { sql } from "valnor-postgres";

describe("valnor postgres sql tests", () => {
   const TEST_MARKER = "sql-test";

   test("insert account", async () => {
      const account = await sql`
         insert into ${Account}
            ${Account.insertColsVals({
               status: AccountStatusUdt.CREATED,
               firstName: "John",
               lastName: "Doe",
               email: `john.doe-${TEST_MARKER}@example.com`,
            })}
            returning ${row(Account.$$)}
      `.getOneRequired({ db: pool });

      expect(account).toMatchObject({
         status: AccountStatusUdt.CREATED,
         firstName: "John",
         lastName: "Doe",
         email: `john.doe-${TEST_MARKER}@example.com`,
      });
   });
});
