import { POSTGRES_DATABASE, POSTGRES_HOST, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER } from "./config.js";
import pg, { Pool } from "pg";

// Return date columns as strings to avoid timezone-dependent Date objects
pg.types.setTypeParser(1082, (val) => val);

export const pool = new Pool({
   host: POSTGRES_HOST,
   port: POSTGRES_PORT,
   user: POSTGRES_USER,
   password: POSTGRES_PASSWORD,
   database: POSTGRES_DATABASE,
});
