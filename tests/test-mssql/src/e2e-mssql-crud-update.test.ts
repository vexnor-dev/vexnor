import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { param } from "vexnor";
import { sql } from "@vexnor/mssql";
import "@vexnor/mssql";
import { Account, IAccountSelect } from "./codegen/vexnor_dev.schema.js";
import { pool } from "./mssql-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("vexnor mssql CRUD - update", async (ctx) => {
   let rootAccount!: IAccountSelect;

   const dataManager = new TestDataManager(ctx, {
      ACCOUNT_ROOT_COUNT: 1,
   });

   beforeAll(async () => {
      await dataManager.initRootAccounts(pool);
      rootAccount = dataManager.rootAccounts[0]!;
      ok(rootAccount, `no 'rootAccount' initialized.`);
   });

   test("update: update account firstName", async () => {
      const idParam = param<{ id: string }>("id");
      const query = Account.mssql.update({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      });
      const result = await query.one({
         db: pool.request(),
         params: { set: { firstName: "UpdatedRoot" }, id: rootAccount.accountId },
      });
      expect(result.firstName).toBe("UpdatedRoot");
      rootAccount = result;
   });
});
