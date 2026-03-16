import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { param } from "valnor";
import { postgresCrud, sql } from "valnor-postgres";
import { Account, IAccountSelect } from "./codegen/valnor_test.schema.js";
import { pool } from "./postgres-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("valnor postgres CRUD - update", async (ctx) => {
   const AccountCrud = postgresCrud(Account);

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
      const query = AccountCrud.update!({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      });

      const result = await query.getOneRequired({
         db: pool,
         params: { set: { firstName: "UpdatedRoot" }, id: rootAccount.accountId },
      });
      expect(result.firstName).toBe("UpdatedRoot");
      rootAccount = result;
   });
});
