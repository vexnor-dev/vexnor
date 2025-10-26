import { SqlColumn } from "./sql-column.js";
import { RowIn, RowOut } from "../sql-types.js";
import { SqlTable, SqlTableCallable, SqlTableColumns } from "./sql-table.js";

export interface NewTableOptions<T extends { Select: RowOut }> {
   readonly schema?: string;
   readonly name: string;
   readonly alias?: string;
   readonly pk?: Array<keyof T["Select"]>;
   readonly types?: T;
}

export function newSqlTable<
   TColumns extends Record<keyof TTypes["Select"], SqlColumn | string>,
   TTypes extends {
      Select: RowOut;
      Insert?: RowIn;
      Update?: RowIn;
   },
>(
   options: NewTableOptions<TTypes>,
   columns: TColumns,
): SqlTable<TTypes & { Columns: TColumns }> &
   SqlTableColumns<TColumns> &
   SqlTableCallable<TTypes & { Columns: TColumns }> {
   return SqlTable.newTable<TTypes & { Columns: TColumns }>({
      ...options,
      columns,
   });
}
