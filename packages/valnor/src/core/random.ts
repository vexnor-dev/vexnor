import crypto from "node:crypto";

export const Random = {
   name(text: string, size = 3): string {
      return text + "_" + crypto.randomBytes(size).toString("hex");
   },
};

export function randomName(text: string, size = 3) {
   return text + "_" + crypto.randomBytes(size).toString("hex");
}
