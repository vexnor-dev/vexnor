import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import Database from "better-sqlite3";
import type { TestContext } from "vitest";

export function getTag(ctx: TestContext) {
   return ctx.task.id;
}

const Config = Type.Object({
   SQLITE_PATH: Type.String({ minLength: 1 }),
});

export async function readConfig() {
   return Value.Decode(Config, process.env);
}

export const { SQLITE_PATH } = await readConfig();

export const db = new Database(SQLITE_PATH) as Database.Database;
