import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { loadEnv } from "@valnor/test-utils";
import Database from "better-sqlite3";
import type { TestContext } from "vitest";

export function getTag(ctx: TestContext) {
   return ctx.task.id;
}

const Env = Type.Object({
   ENV_PATH: Type.String({ minLength: 1 }),
});

export async function readEnv() {
   return Value.Decode(Env, process.env);
}

const Config = Type.Object({
   SQLITE_PATH: Type.String({ minLength: 1 }),
});

export async function readConfig() {
   await loadEnv({
      filePath: "../../env-dev.json",
      environments: ["sqlite3"],
   });

   return Value.Decode(Config, process.env);
}

export const { SQLITE_PATH } = await readConfig();

export const db = (await readConfig().then(async ({ SQLITE_PATH }) => new Database(SQLITE_PATH))) as Database.Database;
