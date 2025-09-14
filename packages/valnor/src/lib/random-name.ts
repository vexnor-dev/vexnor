import crypto from "node:crypto";

export function randomName(text: string, size = 3): string {
   return text + "_" + crypto.randomBytes(size).toString("base64");
}
