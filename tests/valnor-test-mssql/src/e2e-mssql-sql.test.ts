import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { sql } from "valnor-mssql";
import { Account, IAccountSelect } from "./codegen/valnor_test.account-table.js";
import { randomUUID } from "node:crypto";
import { pool } from "./mssql-pool.js";

describe("valnor postgres sql tests", () => {
   beforeAll(async () => {
      await pool.connect();
      await sql<object>`
         delete
         from ${Account}
         where ${Account.$accountId} <> ${randomUUID()}
      `.run({ db: pool.request() });
   });

   afterAll(async () => {
      await pool.close();
   });

   test("insert account", async () => {
      const account = await sql<IAccountSelect>`
         insert into ${Account}
            ${Account.insertCols({
               status: "CREATED",
               firstName: "John",
               lastName: "Doe",
               email: "john.doe@example.com",
            })}
            output ${Account`inserted`.$$all}
            ${Account.insertVals({
               status: "CREATED",
               firstName: "John",
               lastName: "Doe",
               email: "john.doe@example.com",
            })}
      `.getOneRequired({ db: pool.request() });

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
