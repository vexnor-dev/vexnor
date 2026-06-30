import { describe, expect, test } from "vitest";
import { Account } from "./codegen/vexnor_dev.account-table.js";
import { pool } from "./postgres-pool.js";
import { AccountStatusUdt } from "./codegen/vexnor_dev-enums.js";
import { insert, row } from "@vexnor/core";
import { sql } from "@vexnor/postgres";

describe("vexnor postgres sql tests", () => {
   const TEST_MARKER = "sql-test";

   test("insert account", async () => {
      const account = await sql`
         insert into ${Account}
            ${insert(Account, "rows")}
            returning ${row(Account.$$)}
      `.one({ db: pool, params: { rows: [{
               status: AccountStatusUdt.CREATED,
               firstName: "John",
               lastName: "Doe",
               email: `john.doe-${TEST_MARKER}@example.com`,
            }] } });

      expect(account).toMatchObject({
         status: AccountStatusUdt.CREATED,
         firstName: "John",
         lastName: "Doe",
         email: `john.doe-${TEST_MARKER}@example.com`,
      });
   });
});
