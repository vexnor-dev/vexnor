import { describe, expect, test } from "vitest";
import { sql } from "valnor-mssql";
import { Account } from "./codegen/valnor_test.account-table.js";
import { pool } from "./mssql-pool.js";
import { row } from "valnor";
import { getTag } from "./config.js";

describe("valnor postgres sql tests", (ctx) => {
   const TAG = getTag(ctx);

   test("insert account", async () => {
      const query = sql`
         insert into ${Account}
            ${Account.insertCols({
               status: "CREATED",
               firstName: `John-0-${TAG}}`,
               lastName: `Doe-0-${TAG}}`,
               email: `john.doe-${TAG}@example.com`,
            })}
            output ${row(Account.as(`inserted`).$$)}
            ${Account.insertVals({
               status: "CREATED",
               firstName: `John-0-${TAG}}`,
               lastName: `Doe-0-${TAG}}`,
               email: `john.doe-${TAG}@example.com`,
            })}
      `;

      const account = await query.getOneRequired({ db: (await pool).request() });
      expect(account).toEqual(
         expect.objectContaining({
            status: "CREATED",
            firstName: `John-0-${TAG}}`,
            lastName: `Doe-0-${TAG}}`,
            email: `john.doe-${TAG}@example.com`,
         }),
      );
   });
});
