import { RowIn, SqlQueryRowOut } from "../sql-types.js";
import { SqlTable, SqlTableCallable, SqlTableColumns } from "./sql-table.js";

export interface NewTableOptions<T extends { Select: SqlQueryRowOut }> {
   readonly schema?: string;
   readonly name: string;
   readonly alias?: string;
   readonly pk?: Array<keyof T["Select"]>;
   readonly types?: T;
}

export function newSqlTable<
   Columns extends Record<keyof Types["Select"], string>,
   Types extends {
      Select: SqlQueryRowOut;
      Insert?: RowIn;
      Update?: RowIn;
   },
>(
   options: NewTableOptions<Types>,
   columns: Columns,
): SqlTable<Types & { Columns: Columns }> &
   SqlTableColumns<Types["Select"]> &
   SqlTableCallable<Types & { Columns: Columns }> {
   return SqlTable.newTable<Types & { Columns: Columns }>({
      ...options,
      columns,
   });
}
