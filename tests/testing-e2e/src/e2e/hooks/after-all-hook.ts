import { AfterAll } from "@cucumber/cucumber";
import { pool } from "@/db/postgres.js";

AfterAll(async () => {
   await pool.end();
});
