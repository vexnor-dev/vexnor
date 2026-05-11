import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { randomUUID } from "node:crypto";
import { DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from "sequelize";
import { fromSequelizeTable } from "vexnor-sequelize";
import { row, sql, param, excluded } from "vexnor";
import "vexnor-sqlite3";
import { db } from "./config.js";

class AccountModel extends Model<InferAttributes<AccountModel>, InferCreationAttributes<AccountModel>> {
   declare accountId: string;
   declare status: string | null;
   declare email: string;
   declare firstName: string;
   declare lastName: string;
   declare notes: string | null;
   declare createdAt: string | null;
   declare modifiedAt: string | null;
   declare parentId: string | null;
}

let sequelize: Sequelize;
let Account: ReturnType<typeof fromSequelizeTable<AccountModel>>;

describe.sequential("e2e sequelize/sqlite — fromSequelizeTable works against real DB", () => {
   const TAG = "sequelize-sqlite-e2e";
   let account!: InferAttributes<AccountModel>;

   beforeAll(async () => {
      sequelize = new Sequelize("sqlite::memory:", { logging: false });

      AccountModel.init(
         {
            accountId: { type: DataTypes.STRING, allowNull: false, primaryKey: true, field: "account_id" },
            status: { type: DataTypes.STRING, allowNull: true, field: "status" },
            email: { type: DataTypes.STRING, allowNull: false, field: "email" },
            firstName: { type: DataTypes.STRING, allowNull: false, field: "first_name" },
            lastName: { type: DataTypes.STRING, allowNull: false, field: "last_name" },
            notes: { type: DataTypes.TEXT, allowNull: true, field: "notes" },
            createdAt: { type: DataTypes.STRING, allowNull: true, field: "created_at" },
            modifiedAt: { type: DataTypes.STRING, allowNull: true, field: "modified_at" },
            parentId: { type: DataTypes.STRING, allowNull: true, field: "parent_id" },
         },
         {
            sequelize,
            modelName: "AccountModel",
            tableName: "account",
            timestamps: false,
         },
      );

      Account = fromSequelizeTable(AccountModel, "main");

      account = await Account.sqlite.insertRows().one({
         db,
         params: {
            rows: [{ accountId: randomUUID(), email: `${TAG}@example.com`, firstName: "Sequelize", lastName: "Test" }],
         },
      });
      ok(account, "account not inserted");
   });

   afterAll(async () => {
      await sequelize.close();
   });

   test("sql: insert and select", async () => {
      const accountId = randomUUID();

      await sql`
         INSERT INTO ${Account}
            ${Account.insertColsVals({ accountId, email: `${TAG}-sql@example.com`, firstName: "SqlSequelize", lastName: "Test" })}
      `.sqlite.run({ db });

      const selected = await sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE ${Account.$accountId} = ${accountId}
      `.sqlite.one({ db });

      expect(selected.email).toBe(`${TAG}-sql@example.com`);
      expect(selected.firstName).toBe("SqlSequelize");

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${accountId}`.sqlite.run({ db });
   });

   test("crud: insertRows", async () => {
      expect(account.email).toBe(`${TAG}@example.com`);
      expect(account.firstName).toBe("Sequelize");
      expect(account.accountId).toBeDefined();
   });

   test("crud: findById", async () => {
      const result = await Account.sqlite.findById().any({ db, params: { accountId: account.accountId } });
      expect(result?.accountId).toBe(account.accountId);
      expect(result?.email).toBe(account.email);
   });

   test("crud: findBy", async () => {
      const result = await Account.sqlite.findBy().any({ db, params: { email: account.email } });
      expect(result?.accountId).toBe(account.accountId);
   });

   test("crud: select with WHERE", async () => {
      const idParam = param<{ id: string }>("id");
      const results = await Account.sqlite
         .select({
            WHERE: sql`${Account.$accountId} = ${idParam}`,
         })
         .all({ db, params: { id: account.accountId } });
      expect(results).toHaveLength(1);
      expect(results[0]!.accountId).toBe(account.accountId);
   });

   test("crud: update", async () => {
      const idParam = param<{ id: string }>("id");
      const updated = await Account.sqlite
         .update({
            WHERE: sql`${Account.$accountId} = ${idParam}`,
         })
         .one({ db, params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;
   });

   test("crud: upsert", async () => {
      const upserted = await Account.sqlite.upsert({ CONFLICT_ON: [Account.$accountId] }).one({
         db,
         params: {
            rows: [{ accountId: account.accountId, email: account.email, firstName: "Upserted", lastName: "Test" }],
         },
      });
      expect(upserted.accountId).toBe(account.accountId);
      expect(upserted.firstName).toBe("Upserted");
      account = upserted;
   });

   test("crud: upsert with custom SET", async () => {
      const upserted = await Account.sqlite
         .upsert({
            CONFLICT_ON: [Account.$accountId],
            SET: sql`${Account.$firstName} = ${excluded(Account).$firstName}`,
         })
         .one({
            db,
            params: {
               rows: [
                  { accountId: account.accountId, email: account.email, firstName: "UpsertedCustom", lastName: "Test" },
               ],
            },
         });
      expect(upserted.firstName).toBe("UpsertedCustom");
      account = upserted;
   });

   test("crud: delete", async () => {
      const deleted = await Account.sqlite
         .delete({
            WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
         })
         .all({ db, params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.accountId).toBe(account.accountId);
   });
});
