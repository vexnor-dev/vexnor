import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from "sequelize";
import { fromSequelizeTable } from "vexnor-sequelize";
import { row, sql, param } from "vexnor";
import "vexnor-postgres";
import { pool } from "./postgres-pool.js";

class AccountModel extends Model<InferAttributes<AccountModel>, InferCreationAttributes<AccountModel>> {
   declare accountId: CreationOptional<string>;
   declare status: CreationOptional<string | null>;
   declare email: string;
   declare firstName: string;
   declare lastName: string;
   declare notes: CreationOptional<string | null>;
   declare createdAt: CreationOptional<Date | null>;
   declare modifiedAt: CreationOptional<Date | null>;
   declare parentId: CreationOptional<string | null>;
}

let sequelize: Sequelize;
let Account: ReturnType<typeof fromSequelizeTable<AccountModel>>;

describe.sequential("e2e sequelize/pg — fromSequelizeTable works against real DB", () => {
   const TAG = "sequelize-pg-e2e";
   let account!: InferAttributes<AccountModel>;

   beforeAll(async () => {
      sequelize = new Sequelize({
         dialect: "postgres",
         database: "postgres",
         username: "postgres",
         password: "postgres",
         host: "localhost",
         port: 5432,
         logging: false,
      });

      AccountModel.init(
         {
            accountId: { type: DataTypes.UUID, allowNull: false, primaryKey: true, field: "account_id" },
            status: { type: DataTypes.STRING(50), allowNull: true, field: "status" },
            email: { type: DataTypes.STRING, allowNull: false, field: "email" },
            firstName: { type: DataTypes.STRING, allowNull: false, field: "first_name" },
            lastName: { type: DataTypes.STRING, allowNull: false, field: "last_name" },
            notes: { type: DataTypes.TEXT, allowNull: true, field: "notes" },
            createdAt: { type: DataTypes.DATE, allowNull: true, field: "created_at" },
            modifiedAt: { type: DataTypes.DATE, allowNull: true, field: "modified_at" },
            parentId: { type: DataTypes.UUID, allowNull: true, field: "parent_id" },
         },
         {
            sequelize,
            modelName: "AccountModel",
            tableName: "account",
            schema: "vexnor_dev",
            timestamps: false,
         },
      );

      Account = fromSequelizeTable(AccountModel);

      account = await Account.postgres.insertRows().one({
         db: pool,
         params: { rows: [{ email: `${TAG}@example.com`, firstName: "Sequelize", lastName: "Test" }] },
      });
      ok(account, "account not inserted");
   });

   afterAll(async () => {
      await sequelize.close();
   });

   test("sql: insert and select", async () => {
      const inserted = await sql`
         INSERT INTO ${Account}
            ${Account.insertColsVals({ email: `${TAG}-sql@example.com`, firstName: "SqlSequelize", lastName: "Test" })}
            RETURNING ${row(Account.$$)}
      `.postgres.one({ db: pool });

      expect(inserted.email).toBe(`${TAG}-sql@example.com`);
      expect(inserted.firstName).toBe("SqlSequelize");
      expect(inserted.accountId).toBeDefined();

      await sql`DELETE FROM ${Account} WHERE ${Account.$accountId} = ${inserted.accountId}`.postgres.run({ db: pool });
   });

   test("crud: insertRows", async () => {
      expect(account.email).toBe(`${TAG}@example.com`);
      expect(account.firstName).toBe("Sequelize");
      expect(account.accountId).toBeDefined();
   });

   test("crud: findById", async () => {
      const result = await Account.postgres.findById().any({ db: pool, params: { accountId: account.accountId } });
      expect(result?.accountId).toBe(account.accountId);
      expect(result?.email).toBe(account.email);
   });

   test("crud: findBy", async () => {
      const result = await Account.postgres.findBy().any({ db: pool, params: { email: account.email } });
      expect(result?.accountId).toBe(account.accountId);
   });

   test("crud: select with WHERE", async () => {
      const idParam = param<{ id: string }>("id");
      const results = await Account.postgres.select({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      }).all({ db: pool, params: { id: account.accountId } });
      expect(results).toHaveLength(1);
      expect(results[0]!.accountId).toBe(account.accountId);
   });

   test("crud: update", async () => {
      const idParam = param<{ id: string }>("id");
      const updated = await Account.postgres.update({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      }).one({ db: pool, params: { set: { firstName: "Updated" }, id: account.accountId } });
      expect(updated.firstName).toBe("Updated");
      account = updated;
   });

   test("crud: upsert", async () => {
      const upserted = await Account.postgres.upsert({ CONFLICT_ON: [Account.$accountId] }).one({
         db: pool,
         params: {
            rows: [{ accountId: account.accountId, email: account.email, firstName: "Upserted", lastName: "Test" }],
         },
      });
      expect(upserted.accountId).toBe(account.accountId);
      expect(upserted.firstName).toBe("Upserted");
      account = upserted;
   });

   test("crud: delete", async () => {
      const deleted = await Account.postgres.delete({
         WHERE: sql`${Account.$accountId} = ${param<{ id: string }>("id")}`,
      }).all({ db: pool, params: { id: account.accountId } });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.accountId).toBe(account.accountId);
   });
});
