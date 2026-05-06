export function isError(value: unknown): value is Error {
   if (!value) return false;
   if (typeof value !== "object") return false;

   return "message" in value && typeof value.message === "string";
}
