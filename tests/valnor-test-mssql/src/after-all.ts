import { afterAll } from "vitest";
import { pool } from "./mssql-pool.js";

afterAll(async () => {
   await pool.close();
});
