import { afterAll, beforeAll } from "vitest";
import { pool } from "./mssql-pool.js";

beforeAll(async () => {
   await pool.connect();
});

afterAll(async () => {
   await pool.close();
});
