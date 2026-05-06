export type Primitive = string | number | boolean | null | undefined | bigint | Date | Uint8Array;

export function isPrimitive(value: unknown): value is Primitive {
   return (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint" ||
      value instanceof Date ||
      value instanceof Uint8Array
   );
}
