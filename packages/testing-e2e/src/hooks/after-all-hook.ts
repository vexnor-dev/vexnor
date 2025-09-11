import { AfterAll } from "@cucumber/cucumber";
import { pool } from "../db.js";

AfterAll(async () => {
   await pool.end();
});
