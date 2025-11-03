import { ok } from "assert";
import { SqlColumn, SqlColumnAny } from "../schema/index.js";
import { SqlRaw } from "./sql-raw.js";
import { SqlQueryRowOut } from "../sql-types.js";

export class SqlQueryRow {
   static proxyHandler: ProxyHandler<SqlQueryRow> = {
      getPrototypeOf(target) {
         ok(typeof target.constructor.prototype === "object", "prototype is not an instance");

         return target.constructor.prototype;
      },
      get(target, prop) {
         switch (prop) {
            case "toString":
               return target.toString.bind(target);
            case "$":
               return target.$;
            case "$$all":
               return target.$$all;
            default:
               return new SqlColumn({
                  name: prop.toString(),
                  key: prop.toString(),
                  tableInfo: {
                     name: target.name,
                     alias: target.name,
                  },
               });
         }
      },
   };
   readonly $: { name: SqlRaw };
   readonly $$all: SqlColumnAny;
   private readonly name: string;

   constructor({ name }: { name: string }) {
      this.name = name;
      this.$ = {
         name: new SqlRaw(this.name),
      };
      this.$$all = new SqlColumn({
         name: "*",
         key: "*",
         tableInfo: {
            name: this.name,
            alias: this.name,
         },
      });
   }
}

export function newSqlQueryRow<T extends { Row: SqlQueryRowOut }>(args: { name: string }) {
   return new Proxy<SqlQueryRow>(new SqlQueryRow(args), SqlQueryRow.proxyHandler) as SqlQueryRow &
      Record<keyof T["Row"], SqlColumnAny>;
}
