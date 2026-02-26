import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { loadEnv } from "@valnor/test-utils";
import Database from "better-sqlite3";
import type { TestContext } from "vitest";

await loadEnv({
   filePath: "../../env-dev.json",
   environments: ["sqlite3"],
});

const Config = Type.Object({
   SQLITE_PATH: Type.String({ minLength: 1 }),
});

export const { SQLITE_PATH } = Value.Decode(Config, process.env);

export const db = new Database(SQLITE_PATH) as Database.Database;

export function getTag(ctx: TestContext) {
   return ctx.task.id;
}
