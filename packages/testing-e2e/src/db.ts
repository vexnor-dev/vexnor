import { POSTGRES_DATABASE, POSTGRES_HOST, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER } from "./config.js";
import { Pool } from "pg";
import { OneSqlSchema } from "./codegen/one_sql.schema.js";
import { sql } from "valnor";

export { sql };
export const { Account, Order } = OneSqlSchema;

export const pool = new Pool({
   host: POSTGRES_HOST,
   port: POSTGRES_PORT,
   user: POSTGRES_USER,
   password: POSTGRES_PASSWORD,
   database: POSTGRES_DATABASE,
});
