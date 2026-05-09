import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { fromPrismaModelTable } from "vexnor-prisma";
import type { FromPrismaModelResult } from "vexnor-prisma";
import { row, sql, param } from "vexnor";
import "vexnor-mssql";
import { pool } from "./mssql-pool.js";
import { getTag } from "./tags.js";
import { MSSQL_HOST, MSSQL_PORT, MSSQL_DATABASE, MSSQL_USER, MSSQL_PASSWORD } from "./config.js";
import { PrismaClient, PrismaGenerated } from "./prisma-client.js";

describe.sequential("e2e prisma/mssql — fromPrismaModelTable works against real DB", (ctx) => {
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
   const accountModel = PrismaGenerated.Prisma.dmmf.datamodel.models.find((model) => model.name === "Account");
   let account!: AccountRow;
   let Account!: FromPrismaModelResult<AccountRow, AccountInsert, AccountUpdate>;
   let prisma: PrismaClient | undefined;

   beforeAll(async () => {
      process.env.DATABASE_URL =
         `sqlserver://${MSSQL_HOST}:${MSSQL_PORT};database=${MSSQL_DATABASE};` +
         `user=${MSSQL_USER};password=${MSSQL_PASSWORD};schema=vexnor_dev;trustServerCertificate=true`;

      prisma = new PrismaClient({
         datasources: {
            db: {
               url:
                  `sqlserver://${MSSQL_HOST}:${MSSQL_PORT};database=${MSSQL_DATABASE};` +
                  `user=${MSSQL_USER};password=${MSSQL_PASSWORD};schema=vexnor_dev;trustServerCertificate=true`,
            },
         },
      });

      const prismaInserted = await prisma.account.create({
         data: { email: `${TAG}-prisma@example.com`, firstName: "PrismaClient", lastName: "Test" },
         select: { accountId: true, email: true },
      });
      const prismaFetched = await prisma.account.findUnique({
         where: { accountId: prismaInserted.accountId },
         select: { accountId: true, email: true },
      });
      expect(prismaFetched?.email).toBe(`${TAG}-prisma@example.com`);

      expect(accountModel).toBeDefined();
      Account = fromPrismaModelTable<AccountRow, AccountInsert, AccountUpdate>(accountModel!, {
         provider: "sqlserver",
         schema: "vexnor_dev",
      });

      account = await Account.mssql.insertRows().one({
         db: pool.request(),
         params: { rows: [{ email: `${TAG}@example.com`, firstName: "Prisma", lastName: "Test" }] },
      });
      ok(account, "account not inserted");
   });

   test("sql: insert and select", async () => {
      const inserted = await sql`
         INSERT INTO ${Account}
            ${Account.insertCols({ email: `${TAG}-sql@example.com`, firstName: "SqlPrisma", lastName: "Test" })}
            OUTPUT ${row(Account.as("inserted").$$)}
            ${Account.insertVals({ email: `${TAG}-sql@example.com`, firstName: "SqlPrisma", lastName: "Test" })}
      `.mssql.one({ db: pool.request() });

      expect(inserted.email).toBe(`${TAG}-sql@example.com`);
      expect(inserted.firstName).toBe("SqlPrisma");
      expect(inserted.accountId).toBeDefined();

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${String(inserted.accountId)}`.mssql.run({ db: pool.request() });
   });

   test("crud: full cycle", async () => {
      expect(account.email).toBe(`${TAG}@example.com`);

      const byId = await Account.mssql.findById().any({ db: pool.request(), params: { accountId: account.accountId } });
      expect(String(byId?.accountId).toLowerCase()).toBe(String(account.accountId).toLowerCase());

      const byEmail = await Account.mssql.findBy().any({ db: pool.request(), params: { email: account.email } });
      expect(String(byEmail?.accountId).toLowerCase()).toBe(String(account.accountId).toLowerCase());

      const selected = await Account.mssql
         .select({ WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}` })
         .all({ db: pool.request(), params: { id: account.accountId } });
      expect(selected).toHaveLength(1);

      const updated = await Account.mssql
         .update({ WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}` })
         .one({ db: pool.request(), params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;

      const upserted = await Account.mssql.upsert({ MERGE_ON: [Account.$accountId!] }).one({
         db: pool.request(),
         params: {
            rows: [{ accountId: account.accountId, email: account.email, firstName: "Upserted", lastName: "Test" }],
         },
      });
      expect(upserted.firstName).toBe("Upserted");
      account = upserted;

      const deleted = await Account.mssql
         .delete({ WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}` })
         .all({ db: pool.request(), params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
   });

   afterAll(async () => {
      if (prisma) await prisma.$disconnect();
   });
});
