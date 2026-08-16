import {
   blobValue,
   dateValue,
   DuckDBTypeId,
   type DuckDBPreparedStatement,
   type DuckDBType,
   type DuckDBValue,
   listValue,
   mapValue,
   structValue,
   timestampMillisValue,
   timestampNanosValue,
   timestampSecondsValue,
   timestampTZValue,
   timestampValue,
} from "@duckdb/node-api";

export function hasComplexDuckDBValues(values: readonly unknown[]): boolean {
   return values.some((value) => typeof value === "object" && value !== null);
}

export function toDuckDBValue(value: unknown): DuckDBValue {
   if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "bigint" || typeof value === "string") {
      return value;
   }
   if (value === undefined) {
      throw new TypeError("Undefined cannot be bound as a DuckDB parameter; use null for SQL NULL");
   }
   if (value instanceof Date) {
      return timestampMillisValue(BigInt(value.getTime()));
   }
   if (value instanceof Uint8Array) {
      return blobValue(value);
   }
   if (Array.isArray(value)) {
      return listValue(value.map(toDuckDBValue));
   }
   if (value instanceof Map) {
      return mapValue(
         [...value.entries()].map(([key, entryValue]) => ({
            key: toDuckDBValue(key),
            value: toDuckDBValue(entryValue),
         })),
      );
   }
   if (isPlainObject(value)) {
      return structValue(Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [key, toDuckDBValue(entryValue)])));
   }
   if (isDuckDBValueObject(value)) {
      return value;
   }
   throw new TypeError(`Unsupported DuckDB parameter value: ${Object.prototype.toString.call(value)}`);
}

export function bindDuckDBValue(statement: DuckDBPreparedStatement, index: number, value: unknown): void {
   if (value === null || value === undefined) {
      statement.bindNull(index);
      return;
   }

   const type = statement.parameterType(index);

   if (value instanceof Date) {
      bindDate(statement, index, value, type);
      return;
   }
   if (value instanceof Uint8Array) {
      statement.bindBlob(index, value);
      return;
   }
   if (typeof value === "object" && type.alias?.toUpperCase() === "JSON") {
      statement.bindVarchar(index, JSON.stringify(value));
      return;
   }
   if (typeof value === "string") {
      statement.bindVarchar(index, value);
      return;
   }

   statement.bindValue(index, toDuckDBValue(value), type.typeId === DuckDBTypeId.ANY ? undefined : type);
}

function bindDate(statement: DuckDBPreparedStatement, index: number, value: Date, type: DuckDBType): void {
   const milliseconds = BigInt(value.getTime());
   switch (type.typeId) {
      case DuckDBTypeId.DATE:
         statement.bindDate(index, dateValue(Math.floor(value.getTime() / 86_400_000)));
         return;
      case DuckDBTypeId.TIMESTAMP_S:
         statement.bindTimestampSeconds(index, timestampSecondsValue(milliseconds / 1_000n));
         return;
      case DuckDBTypeId.TIMESTAMP_MS:
         statement.bindTimestampMilliseconds(index, timestampMillisValue(milliseconds));
         return;
      case DuckDBTypeId.TIMESTAMP_NS:
         statement.bindTimestampNanoseconds(index, timestampNanosValue(milliseconds * 1_000_000n));
         return;
      case DuckDBTypeId.TIMESTAMP_TZ:
         statement.bindTimestampTZ(index, timestampTZValue(milliseconds * 1_000n));
         return;
      default:
         statement.bindTimestamp(index, timestampValue(milliseconds * 1_000n));
   }
}

function isPlainObject(value: object): value is Record<string, unknown> {
   return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
}

function isDuckDBValueObject(value: object): value is Exclude<DuckDBValue, null | boolean | number | bigint | string> {
   return typeof value.constructor === "function" && value.constructor.name.startsWith("DuckDB");
}
