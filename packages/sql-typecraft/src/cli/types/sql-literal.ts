export enum SqlLiteralType {
   String = "string",
   Number = "number",
   Boolean = "boolean",
   Date = "Date",
   BigInt = "BigInt",
   Buffer = "Buffer",
   Udt = "Udt",
}

export function isSqlType(value: unknown): value is SqlLiteralType {
   if (!value) return false;
   if (typeof value !== "string") return false;
   return Object.values(SqlLiteralType).includes(value as SqlLiteralType);
}

export type SqlLiteral = string | number | Date | bigint | boolean | null | Buffer;

export function assertIsSqlLiteral(value: unknown): asserts value is SqlLiteral {
   switch (typeof value) {
      case "undefined":
      case "string":
      case "boolean":
      case "bigint":
      case "number":
         return;
      case "object":
         if (value === null) return;
         if (value instanceof Date) return;
         throw new TypeError(`Unknown SQL type: ${value}`);
   }
}
