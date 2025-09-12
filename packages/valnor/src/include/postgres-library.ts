import postgres, { Row } from "postgres";
import { ok } from "node:assert";

export type PostgresLibrary<T extends Row> = {
   [K in keyof T]: postgres.Helper<T[K]>;
};

export function newSqlTyped<T extends Record<string | symbol, unknown>>(
   sql: postgres.Sql,
   table: T,
): PostgresLibrary<T> {
   const proxyHandler: ProxyHandler<T> = {
      get(target, prop) {
         ok(isSqlTableType(target), `${target} is not a valid SQL Table Type`);
         const value = target[prop];
         switch (prop) {
            case "$table":
               return sql(target.$table);
            case "$all":
               return sql(target.$all.map((col) => `${target.$table}.${col}`));
            case "$from":
               return sql(target.$from);
            default:
               return sql(`${target.$table}.${value}`);
         }
      },
   };

   return new Proxy(table, proxyHandler) as PostgresLibrary<T>;
}

function isSqlTableType(value: unknown): value is {
   $table: string;
   $from: string;
   $all: string[];
} & Record<string | symbol, unknown> {
   if (!value) return false;

   if (typeof value !== "object") return false;

   if (!("$all" in value)) {
      return false;
   }

   if (!Array.isArray(value.$all)) {
      return false;
   }

   if (!("$from" in value)) {
      return false;
   }

   if (typeof value.$from !== "string") {
      return false;
   }

   if (!("$table" in value)) {
      return false;
   }

   return typeof value.$table === "string";
}
