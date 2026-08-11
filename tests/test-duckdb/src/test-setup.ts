import { afterAll } from "vitest";
import { closeDatabase } from "./config.js";

afterAll(async () => {
   await closeDatabase();
});
