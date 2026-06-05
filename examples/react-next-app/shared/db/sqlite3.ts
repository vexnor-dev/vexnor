import BetterSqlite3 from "better-sqlite3";
import path from "node:path";

export const sqliteDb = new BetterSqlite3(
   path.resolve(process.cwd(), process.env.SQLITE_PATH ?? "../../@db-sqlite3/vexnor-dev.sqlite"),
);
