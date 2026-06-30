import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { fileURLToPath } from "node:url";
import type { FromPrismaModelResult } from "@vexnor/prisma";
import { findPrismaModel, fromPrismaModelTable } from "@vexnor/prisma";
import { insert, param, row, sql } from "@vexnor/core";
import "@vexnor/mssql";
import { pool } from "./mssql-pool.js";
import { getTag } from "./tags.js";
import { MSSQL_DATABASE, MSSQL_HOST, MSSQL_PASSWORD, MSSQL_PORT, MSSQL_USER } from "./config.js";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { Prisma, PrismaClient } from "../prisma/generated/client.js";

describe.sequential("e2e prisma/mssql — fromPrismaModelTable works against real DB", (ctx) => {
   const TAG = getTag(ctx);
   type AccountRow = Prisma.AccountSelect;
   type AccountInsert = Pick<Prisma.AccountUncheckedCreateInput,
      "accountId" | "email" | "firstName" | "lastName"
   >;
   type AccountUpdate = Pick<Prisma.AccountUncheckedUpdateInput,
      "accountId" | "email" | "firstName" | "lastName"
   >;
   let account!: AccountRow;
   let Account!: FromPrismaModelResult<AccountRow, AccountInsert, AccountUpdate>;
   let prisma: PrismaClient | undefined;

   beforeAll(async () => {
      const connectionString =
         `sqlserver://${MSSQL_HOST}:${MSSQL_PORT};database=${MSSQL_DATABASE};` +
         `user=${MSSQL_USER};password=${MSSQL_PASSWORD};trustServerCertificate=true`;

      prisma = new PrismaClient({ adapter: new PrismaMssql(connectionString) });

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
         provider: "sqlserver",
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
            (${insert.cols(Account, "rows")})
            OUTPUT ${row(Account.as("inserted").$$)}
            VALUES ${insert.values(Account, "rows")}
      `.mssql.one({ db: pool.request(), params: { rows: [{ email: `${TAG}-sql@example.com`, firstName: "SqlPrisma", lastName: "Test" }] } });

      expect(inserted.email).toBe(`${TAG}-sql@example.com`);
      expect(inserted.firstName).toBe("SqlPrisma");
      expect(inserted.accountId).toBeDefined();

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${String(inserted.accountId)}`.mssql.run({ db: pool.request() });
   });

   test("crud: full cycle", async () => {
      expect(account.email).toBe(`${TAG}@example.com`);

      const selected = await Account.mssql
         .select({ WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}` })
         .all({ db: pool.request(), params: { id: String(account.accountId) } });
      expect(selected).toHaveLength(1);

      const updated = await Account.mssql
         .update({ WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}` })
         .one({ db: pool.request(), params: { set: { firstName: "Updated" }, id: String(account.accountId) } });
      expect(updated.firstName).toBe("Updated");
      account = updated;

      const upserted = await Account.mssql.upsert({ MERGE_ON: [Account.$accountId!] }).one({
         db: pool.request(),
         params: {
            rows: [{ accountId: String(account.accountId), email: String(account.email), firstName: "Upserted", lastName: "Test" }],
         },
      });
      expect(upserted.firstName).toBe("Upserted");
      account = upserted;

      const deleted = await Account.mssql
         .delete({ WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}` })
         .all({ db: pool.request(), params: { id: String(account.accountId) } });
      expect(deleted).toHaveLength(1);
   });

   afterAll(async () => {
      if (prisma) await prisma.$disconnect();
   });
});
