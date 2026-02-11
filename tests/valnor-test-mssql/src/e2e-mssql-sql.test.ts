import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { sql } from "valnor-mssql";
import { Account } from "./codegen/valnor_test.account-table.js";
import { randomUUID } from "node:crypto";
import { pool } from "./mssql-pool.js";
import { row } from "valnor";

describe("valnor postgres sql tests", () => {
   beforeAll(async () => {
      await pool.connect();
      const query = sql`
         delete
         from ${Account}
         where ${Account.$accountId} <> ${randomUUID()}
      `;
      await query.run({ db: pool.request() });
   });

   afterAll(async () => {
      await pool.close();
   });

   test("insert account", async () => {
      const query = sql`
         insert into ${Account}
            ${Account.insertCols({
               status: "CREATED",
               firstName: "John",
               lastName: "Doe",
               email: "john.doe@example.com",
            })}
            output ${row(Account.as(`inserted`).$$)}
            ${Account.insertVals({
               status: "CREATED",
               firstName: "John",
               lastName: "Doe",
               email: "john.doe@example.com",
            })}
      `;

      const account = await query.getOneRequired({ db: pool.request() });
      expect(account).toEqual(
         expect.objectContaining({
            status: "CREATED",
            firstName: "John",
            lastName: "Doe",
            email: "john.doe@example.com",
         }),
      );
   });
});
