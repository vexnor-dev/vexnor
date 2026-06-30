import { SqlBuildOptions } from "@vexnor/core";
import { Sqlite3Tokenizer } from "#src/sqlite3-tokenizer.js";

export const defaultQueryOptions: SqlBuildOptions = {
   dialect: "sqlite",
   tokenizer: new Sqlite3Tokenizer(),
   paramFormat: () => `?`,
};
