import { ok } from "node:assert";
import "./valnor-mssql.js";
import { ValnorMssql } from "./valnor-mssql.js";

const { MSSQL_DATABASE, MSSQL_HOST, MSSQL_PASSWORD, MSSQL_USER, MSSQL_PORT } = process.env;
ok(MSSQL_DATABASE, "MSSQL_DATABASE is required");
ok(MSSQL_HOST, "MSSQL_HOST is required");
ok(MSSQL_PASSWORD, "MSSQL_PASSWORD is required");
ok(MSSQL_USER, "MSSQL_USER is required");
ok(MSSQL_PORT, "MSSQL_PORT is required");

// const { ConnectionPool } = mssql;
// const pool = new ConnectionPool({
//    server: MSSQL_HOST,
//    port: +MSSQL_PORT,
//    user: MSSQL_USER,
//    password: MSSQL_PASSWORD,
//    database: MSSQL_DATABASE,
//    options: {
//       encrypt: true, // for Azure SQL
//       trustServerCertificate: true, // change to false for production
//    },
// });
// await pool.connect();
//
// const keys = await TablePrimaryKey.mssql.getAll({ db: pool.request(), params: { schemas: ["valnor_test"] } });
// console.log(keys);

const plugin = new ValnorMssql();
const tables = await plugin.getSchema({
   schemas: ["valnor_test"],
   database: MSSQL_DATABASE,
   user: MSSQL_USER,
   password: MSSQL_PASSWORD,
   host: MSSQL_HOST,
   port: +MSSQL_PORT,
});

console.log(tables);
