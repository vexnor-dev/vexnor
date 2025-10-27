import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { loadEnv } from "@valnor/test-utils";

await loadEnv({
   filePath: "../../env-dev.json",
   environments: ["sqlite3"],
});

const Config = Type.Object({
   SQLITE_PATH: Type.String({ minLength: 1 }),
});

export const { SQLITE_PATH } = Value.Decode(Config, process.env);
