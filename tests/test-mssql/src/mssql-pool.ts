import { ConnectionPool } from "mssql";
import { MSSQL_DATABASE, MSSQL_HOST, MSSQL_PASSWORD, MSSQL_PORT, MSSQL_USER } from "./config.js";

export const pool = new ConnectionPool({
   server: MSSQL_HOST,
   port: MSSQL_PORT,
   database: MSSQL_DATABASE,
   user: MSSQL_USER,
   password: MSSQL_PASSWORD,
   options: {
      trustServerCertificate: true,
   },
});
