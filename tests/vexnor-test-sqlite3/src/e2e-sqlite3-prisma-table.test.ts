import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { findPrismaModel, fromPrismaModelTable } from "vexnor-prisma";
import type { FromPrismaModelResult } from "vexnor-prisma";
import { row, sql, param, excluded } from "vexnor";
import "vexnor-sqlite3";
import { db, SQLITE_PATH } from "./config.js";
import { getTag } from "./tags.js";
import { PrismaClient } from "../prisma/generated/client.js";
import * as PrismaGenerated from "../prisma/generated/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

describe.sequential("e2e prisma/sqlite — fromPrismaModelTable works against real DB", (ctx) => {
   const TAG = getTag(ctx);
   type AccountRow = PrismaGenerated.Account;
   type AccountInsert = Pick<
      PrismaGenerated.Prisma.AccountUncheckedCreateInput,
      "accountId" | "email" | "firstName" | "lastName"
   >;
   type AccountUpdate = Pick<
      PrismaGenerated.Prisma.AccountUncheckedUpdateInput,
      "accountId" | "email" | "firstName" | "lastName"
   >;
   let account!: AccountRow;
   let Account!: FromPrismaModelResult<AccountRow, AccountInsert, AccountUpdate>;
   let prisma: PrismaClient | undefined;
   beforeAll(async () => {
      const url = `file:${SQLITE_PATH}`;
      process.env.DATABASE_URL = url;

      prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

      const prismaId = randomUUID();
      const prismaInserted = await prisma.account.create({
         data: { accountId: prismaId, email: `${TAG}-prisma@example.com`, firstName: "PrismaClient", lastName: "Test" },
         select: { accountId: true, email: true },
      });
      const prismaFetched = await prisma.account.findUnique({
         where: { accountId: prismaInserted.accountId },
         select: { accountId: true, email: true },
      });
      expect(prismaFetched?.email).toBe(`${TAG}-prisma@example.com`);

      const schemaPath = fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url));
      const accountModel = await findPrismaModel("Account", { schemaPath });
      Account = fromPrismaModelTable<AccountRow, AccountInsert, AccountUpdate>(accountModel, {
         provider: "sqlite",
         schema: "main",
      });

      account = await Account.sqlite.insertRows().one({
         db,
         params: {
            rows: [{ accountId: randomUUID(), email: `${TAG}@example.com`, firstName: "Prisma", lastName: "Test" }],
         },
      });
      ok(account, "account not inserted");
   });

   test("sql: insert and select", async () => {
      const accountId = randomUUID();

      await sql`
         INSERT INTO ${Account}
            ${Account.insertColsVals({ accountId, email: `${TAG}-sql@example.com`, firstName: "SqlPrisma", lastName: "Test" })}
      `.sqlite.run({ db });

      const selected = await sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE ${Account.$accountId} = ${accountId}
      `.sqlite.one({ db });

      expect(selected.email).toBe(`${TAG}-sql@example.com`);
      expect(selected.firstName).toBe("SqlPrisma");
   });

   test("crud: full cycle", async () => {
      expect(account.email).toBe(`${TAG}@example.com`);

      const byId = await Account.sqlite.findById().any({ db, params: { accountId: account.accountId } });
      expect(byId?.accountId).toBe(account.accountId);

      const byEmail = await Account.sqlite.findBy().any({ db, params: { email: account.email } });
      expect(byEmail?.accountId).toBe(account.accountId);

      const selected = await Account.sqlite
         .select({ WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}` })
         .all({ db, params: { id: account.accountId } });
      expect(selected).toHaveLength(1);

      const updated = await Account.sqlite
         .update({ WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}` })
         .one({ db, params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;

      const upserted = await Account.sqlite
         .upsert({ CONFLICT_ON: [Account.$accountId!], SET: sql`${Account.$firstName!} = ${excluded(Account).$firstName!}` })
         .one({
            db,
            params: {
               rows: [
                  { accountId: account.accountId, email: account.email, firstName: "Upserted", lastName: "Test" },
               ],
            },
         });
      expect(upserted.firstName).toBe("Upserted");
      account = upserted;

      const deleted = await Account.sqlite
         .delete({ WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}` })
         .all({ db, params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
   });

   afterAll(async () => {
      if (prisma) await prisma.$disconnect();
   });
});
