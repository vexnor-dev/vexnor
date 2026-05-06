import { SqlBuildOptions } from "vexnor";
import { Sqlite3Tokenizer } from "#/sqlite3-tokenizer.js";

export const defaultQueryOptions: SqlBuildOptions = {
   dialect: "sqlite",
   tokenizer: new Sqlite3Tokenizer(),
   paramFormat: () => `?`,
};
