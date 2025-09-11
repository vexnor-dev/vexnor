import * as crypto from "node:crypto";

export type JsonRow<T> =
   T extends Record<string, unknown> ? { [K in keyof T]: T[K] extends Date ? string : T[K] } : never;

export function generateRandomName(size = 3): string {
   return crypto.randomBytes(size).toString("base64");
}
