import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { param } from "valnor";
import { defaultQueryOptions, postgresCrud, sql } from "valnor-postgres";
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
      const { text, values } = query.getSql({
         params: { set: { firstName: "UpdatedRoot" }, id: rootAccount.accountId },
         options: defaultQueryOptions,
      });
      expect(values).toMatchObject(["UpdatedRoot", rootAccount.accountId]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: postgres */
        UPDATE "valnor_test"."account"
        /* <query_1> */
        SET
          /* <query_2> */ "first_name" = $1 /* </query_2> */ /* </query_1> */
          /* <query_3> */
        WHERE
          /* <query_4> */ "account"."account_id" = $2 /* </query_4> */ /* </query_3> */
        RETURNING
          "account"."account_id" AS "accountId",
          "account"."status",
          "account"."email",
          "account"."first_name" AS "firstName",
          "account"."last_name" AS "lastName",
          "account"."notes",
          "account"."created_at" AS "createdAt",
          "account"."modified_at" AS "modifiedAt",
          "account"."parent_id" AS "parentId"
          /* </query_0> */"
      `);

      const result = await query.getOneRequired({
         db: pool,
         params: { set: { firstName: "UpdatedRoot" }, id: rootAccount.accountId },
      });
      expect(result.firstName).toBe("UpdatedRoot");
      rootAccount = result;
   });
});
