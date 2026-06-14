import { afterAll } from "vitest";
import { pool } from "./postgres-pool.js";

afterAll(async () => {
   await pool.end();
});
