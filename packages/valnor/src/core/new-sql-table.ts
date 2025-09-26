import { SqlColumn } from "./sql-column.js";
import { RowIn, RowOut } from "./sql-types.js";
import { x } from "../x.js";
import { SqlTable } from "./sql-table.js";
import { Random } from "./random.js";

type SqlTableColumns<T> = T extends Record<string, SqlColumn | string> ? { [K in keyof T]: SqlColumn } : never;

export interface NewTableOptions<TTypes> {
   readonly schema?: string;
   readonly name: string;
   readonly alias?: string;
   readonly pk?: SqlColumn | string;
   readonly types?: TTypes;
}

export function newSqlTable<
   TColumns extends Record<keyof TTypes["Select"], SqlColumn | string>,
   TTypes extends {
      Select: RowOut;
      Insert?: RowIn;
      Update?: RowIn;
   },
>(options: NewTableOptions<TTypes>, cols: TColumns): SqlTable<TTypes> & SqlTableColumns<TColumns> {
   const table = {
      name: options.name,
      alias: options.alias ?? Random.name(options.name),
   };
   const pk = x(() => {
      if (!options.pk) return undefined;
      if (typeof options.pk === "string") {
         return new SqlColumn({ alias: options.pk, name: options.pk, table: table });
      }

      return new SqlColumn({ ...options.pk, table: table });
   });
   const __cols__ = x(() => {
      const columns: Record<string, SqlColumn> = {};
      for (const [key, value] of Object.entries(cols)) {
         if (typeof value === "string") {
            columns[key] = new SqlColumn({ alias: key, name: value, table: table });
         } else if (value instanceof SqlColumn) {
            columns[key] = new SqlColumn({
               ...value,
               table: table,
               alias: key,
            });
         } else {
            throw new Error(`Column ${key} must be a string or SqlColumn instance`);
         }
      }

      return columns;
   });
   const result = new SqlTable<TTypes>({
      ...options,
      pk,
      alias: table.alias,
      cols: __cols__,
   });

   return Object.assign(result, __cols__) as SqlTable<TTypes> & SqlTableColumns<TColumns>;
}
