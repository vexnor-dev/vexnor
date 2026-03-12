import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { param } from "valnor";
import { defaultQueryOptions, mssqlCrud, sql } from "valnor-mssql";
import { Account, IAccountSelect } from "./codegen/valnor_test.schema.js";
import { pool } from "./mssql-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("valnor mssql CRUD - update", async (ctx) => {
   const AccountCrud = mssqlCrud(Account);

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
      const { text, values } = query.getSql({
         params: { set: { firstName: "UpdatedRoot" }, id: rootAccount.accountId },
         options: defaultQueryOptions,
      });
      expect(values).toMatchObject(["UpdatedRoot", rootAccount.accountId]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        UPDATE "valnor_test"."account"
        /* <query_1> */
        SET
          /* <query_2> */ "first_name" = @param_0 /* </query_2> */ /* </query_1> */ output "inserted"."account_id" AS "accountId",
          "inserted"."parent_id" AS "parentId",
          "inserted"."status",
          "inserted"."email",
          "inserted"."first_name" AS "firstName",
          "inserted"."last_name" AS "lastName",
          "inserted"."notes",
          "inserted"."created_at" AS "createdAt",
          "inserted"."modified_at" AS "modifiedAt"
          /* <query_3> */
        WHERE
          /* <query_4> */ "account"."account_id" = @param_1 /* </query_4> */ /* </query_3> */
          /* </query_0> */"
      `);
      const result = await query.getOneRequired({
         db: pool.request(),
         params: { set: { firstName: "UpdatedRoot" }, id: rootAccount.accountId },
      });
      expect(result.firstName).toBe("UpdatedRoot");
      rootAccount = result;
   });
});
