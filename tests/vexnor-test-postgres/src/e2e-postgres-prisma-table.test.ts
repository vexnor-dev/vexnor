import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { fileURLToPath } from "node:url";
import { findPrismaModel, fromPrismaModelTable } from "vexnor-prisma";
import type { FromPrismaModelResult } from "vexnor-prisma";
import { row, sql, param } from "vexnor";
import "vexnor-postgres";
import { pool } from "./postgres-pool.js";
import { POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DATABASE, POSTGRES_USER, POSTGRES_PASSWORD } from "./config.js";
import { getTag } from "./tags.js";
import { PrismaClient } from "../prisma/generated/client.js";
import * as PrismaGenerated from "../prisma/generated/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

describe.sequential("e2e prisma/pg — fromPrismaModelTable works against real DB", (ctx) => {
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
      const connectionString =
         `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}` + `@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`;

      prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

      const prismaInserted = await prisma.account.create({
         data: { email: `${TAG}-prisma@example.com`, firstName: "PrismaClient", lastName: "Test" },
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
         provider: "postgresql",
      });

      account = await Account.postgres.insertRows().one({
         db: pool,
         params: { rows: [{ email: `${TAG}@example.com`, firstName: "Prisma", lastName: "Test" }] },
      });
      ok(account, "account not inserted");
   });

   test("sql: insert and select", async () => {
      const inserted = await sql`
         INSERT INTO ${Account}
            ${Account.insertColsVals({ email: `${TAG}-sql@example.com`, firstName: "SqlPrisma", lastName: "Test" })}
            RETURNING ${row(Account.$$)}
      `.postgres.one({ db: pool });

      expect(inserted.email).toBe(`${TAG}-sql@example.com`);
      expect(inserted.firstName).toBe("SqlPrisma");
      expect(inserted.accountId).toBeDefined();

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${String(inserted.accountId)}`.postgres.run({ db: pool });
   });

   test("crud: full cycle", async () => {
      expect(account.email).toBe(`${TAG}@example.com`);

      const byId = await Account.postgres.findById().any({ db: pool, params: { accountId: account.accountId } });
      expect(byId?.accountId).toBe(account.accountId);

      const byEmail = await Account.postgres.findBy().any({ db: pool, params: { email: account.email } });
      expect(byEmail?.accountId).toBe(account.accountId);

      const selected = await Account.postgres
         .select({ WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}` })
         .all({ db: pool, params: { id: account.accountId } });
      expect(selected).toHaveLength(1);

      const updated = await Account.postgres
         .update({ WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}` })
         .one({ db: pool, params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;

      const upserted = await Account.postgres.upsert({ CONFLICT_ON: [Account.$accountId!] }).one({
         db: pool,
         params: {
            rows: [{ accountId: account.accountId, email: account.email, firstName: "Upserted", lastName: "Test" }],
         },
      });
      expect(upserted.firstName).toBe("Upserted");
      account = upserted;

      const deleted = await Account.postgres
         .delete({ WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}` })
         .all({ db: pool, params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
   });

   afterAll(async () => {
      if (prisma) await prisma.$disconnect();
   });
});
