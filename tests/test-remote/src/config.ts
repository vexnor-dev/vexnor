import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import pg from "pg";
import mssql from "mssql";
import BetterSqlite3, { type Database } from "better-sqlite3";

const Config = Type.Object({
   POSTGRES_HOST: Type.String(),
   POSTGRES_PORT: Type.String(),
   POSTGRES_USER: Type.String(),
   POSTGRES_PASSWORD: Type.String(),
   POSTGRES_DATABASE: Type.String(),
   MSSQL_HOST: Type.String(),
   MSSQL_PORT: Type.String(),
   MSSQL_DATABASE: Type.String(),
   MSSQL_USER: Type.String(),
   MSSQL_PASSWORD: Type.String(),
   VEXNOR_SQLITE_PATH: Type.String({ minLength: 1 }),
});

const env = Value.Decode(Config, process.env);

export const pgPool = new pg.Pool({
   host: env.POSTGRES_HOST,
   port: Number(env.POSTGRES_PORT),
   user: env.POSTGRES_USER,
   password: env.POSTGRES_PASSWORD,
   database: env.POSTGRES_DATABASE,
});

export const mssqlPool = await mssql.connect({
   server: env.MSSQL_HOST,
   port: Number(env.MSSQL_PORT),
   database: env.MSSQL_DATABASE,
   user: env.MSSQL_USER,
   password: env.MSSQL_PASSWORD,
   options: { trustServerCertificate: true },
});

export const sqliteDb: Database = new BetterSqlite3(env.VEXNOR_SQLITE_PATH);
