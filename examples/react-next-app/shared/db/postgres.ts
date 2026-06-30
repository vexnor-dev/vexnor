import { Pool } from "pg";

export const pgPool = new Pool({
   host: process.env.POSTGRES_HOST ?? "localhost",
   port: Number(process.env.POSTGRES_PORT ?? 5432),
   user: process.env.POSTGRES_USER ?? "postgres",
   password: process.env.POSTGRES_PASSWORD ?? "postgres",
   database: process.env.POSTGRES_DATABASE ?? "postgres",
});
