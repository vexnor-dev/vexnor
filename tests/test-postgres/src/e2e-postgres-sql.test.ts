import { describe, expect, test } from "vitest";
import { Account } from "./codegen/vexnor_dev.account-table.js";
import { pool } from "./postgres-pool.js";
import { AccountStatusUdt } from "./codegen/vexnor_dev-enums.js";
import { row } from "@vexnor/core";
import { sql } from "@vexnor/postgres";

describe("vexnor postgres sql tests", () => {
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
      `.one({ db: pool });

      expect(account).toMatchObject({
         status: AccountStatusUdt.CREATED,
         firstName: "John",
         lastName: "Doe",
         email: `john.doe-${TEST_MARKER}@example.com`,
      });
   });
});
