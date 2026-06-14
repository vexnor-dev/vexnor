// noinspection SqlNoDataSourceInspection,SqlResolve
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { HttpRemoteClient, param, row } from "vexnor";
import { sql as pgSql } from "@vexnor/postgres";
import { sql as mssqlSql } from "@vexnor/mssql";
import { sql as sqliteSql } from "@vexnor/sqlite3";
import "@vexnor/postgres";
import "@vexnor/mssql";
import "@vexnor/sqlite3";
import { createTestServer } from "./test-server.js";
import { pgPool, mssqlPool, sqliteDb } from "./config.js";
import { Account as PgAccount, IAccountSelect as IPgAccountSelect } from "./codegen/postgres/vexnor_dev.schema.js";
import { Account as MssqlAccount, IAccountSelect as IMssqlAccountSelect } from "./codegen/mssql/vexnor_dev.schema.js";
import { Account as SqliteAccount, IAccountSelect as ISqliteAccountSelect } from "./codegen/sqlite3/main.schema.js";

const pgSelect = pgSql`
   select ${row(PgAccount.$accountId, PgAccount.$email)}
   from ${PgAccount}
   where ${PgAccount.$accountId} = ${param<{ accountId: string }>("accountId")}
`;
const pgInsert = PgAccount.postgres.insertRows();
const pgDelete = PgAccount.postgres.delete({ WHERE: pgSql`${PgAccount.$accountId} = ${param<{ accountId: string }>("accountId")}` });

const mssqlSelect = mssqlSql`
   select ${row(MssqlAccount.$accountId, MssqlAccount.$email)}
   from ${MssqlAccount}
   where ${MssqlAccount.$accountId} = ${param<{ accountId: string }>("accountId")}
`;
const mssqlInsert = MssqlAccount.mssql.insertRows();
const mssqlDelete = MssqlAccount.mssql.delete({ WHERE: mssqlSql`${MssqlAccount.$accountId} = ${param<{ accountId: string }>("accountId")}` });

const sqliteSelect = sqliteSql`
   select ${row(SqliteAccount.$accountId, SqliteAccount.$email)}
   from ${SqliteAccount}
   where ${SqliteAccount.$accountId} = ${param<{ accountId: string }>("accountId")}
`;
const sqliteInsert = SqliteAccount.sqlite.insertRows();
const sqliteDelete = SqliteAccount.sqlite.delete({ WHERE: sqliteSql`${SqliteAccount.$accountId} = ${param<{ accountId: string }>("accountId")}` });

describe.sequential("cross-plugin — single HttpRemoteClient routes to all three databases", () => {
   let client: HttpRemoteClient;
   let stop: () => Promise<void>;
   let pgAccount: IPgAccountSelect;
   let mssqlAccount: IMssqlAccountSelect;
   let sqliteAccount: ISqliteAccountSelect;
   const TAG = `cross-${Date.now()}`;

   beforeAll(async () => {
      ({ client, stop } = await createTestServer({
         postgres: { pgSelect, pgInsert, pgDelete },
         mssql: { mssqlSelect, mssqlInsert, mssqlDelete },
         sqlite3: { sqliteSelect, sqliteInsert, sqliteDelete },
      }));

      const pgInserted = await pgInsert.all({ db: pgPool, params: { rows: [{ email: `${TAG}@pg.com`, firstName: "Cross", lastName: "PG" }] } });
      ok(pgInserted[0]); pgAccount = pgInserted[0];
      const mssqlInserted = await mssqlInsert.all({ db: mssqlPool.request(), params: { rows: [{ email: `${TAG}@mssql.com`, firstName: "Cross", lastName: "MSSQL" }] } });
      ok(mssqlInserted[0]); mssqlAccount = mssqlInserted[0];
      const sqliteInserted = await sqliteInsert.all({ db: sqliteDb, params: { rows: [{ email: `${TAG}@sqlite.com`, firstName: "Cross", lastName: "SQLite", status: "created" }] } });
      ok(sqliteInserted[0]); sqliteAccount = sqliteInserted[0];
   });

   afterAll(async () => {
      if (pgAccount) await pgDelete.run({ db: pgPool, params: { accountId: pgAccount.accountId } });
      if (mssqlAccount) await mssqlDelete.run({ db: mssqlPool.request(), params: { accountId: mssqlAccount.accountId } });
      if (sqliteAccount) await sqliteDelete.run({ db: sqliteDb, params: { accountId: sqliteAccount.accountId } });
      await stop();
   });

   test("same client routes concurrently to all three plugins", async () => {
      const [pg, mssql, sqlite] = await Promise.all([
         pgSelect.postgres.any({ db: client, params: { accountId: pgAccount.accountId } }),
         mssqlSelect.mssql.any({ db: client, params: { accountId: mssqlAccount.accountId } }),
         sqliteSelect.sqlite.any({ db: client, params: { accountId: sqliteAccount.accountId } }),
      ]);
      expect(pg?.email).toBe(pgAccount.email);
      expect(mssql?.email).toBe(mssqlAccount.email);
      expect(sqlite?.email).toBe(sqliteAccount.email);
   });

   test("unregistered hash returns QUERY_NOT_FOUND", async () => {
      // A fresh query that was never registered in any plugin
      const neverRegistered = pgSql`select 42 as answer`;
      const hash = await neverRegistered.source.hash;
      const res = await fetch(client.targetUrl, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ plugin: "@vexnor/postgres", hash, params: {}, mode: "read", name: null, location: neverRegistered.source.location }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { code: string };
      expect(body.code).toBe("QUERY_NOT_FOUND");
   });
});
