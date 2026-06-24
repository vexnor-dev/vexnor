import { SqlInsert, SqlInsertTypeArgs } from "#/core/operators/sql-insert.js";
import { SqlTable } from "#/core/schema/sql-table.js";
import { SqlInsertCols } from "#/core/operators/sql-insert-cols.js";
import { SqlInsertValues } from "#/core/operators/sql-insert-values.js";

export const insert = <T extends SqlInsertTypeArgs>(
   table: SqlTable<T>,
   paramName?: string,
): SqlInsert<T, string> => {
   return new SqlInsert<T, string>(table, paramName ?? "rows");
};

insert.cols = function<T extends SqlInsertTypeArgs>(
   table: SqlTable<T>,
   paramName?: string,
): SqlInsertCols<T, string> {
   return new SqlInsertCols<T, string>(table, paramName ?? "rows");
}

insert.values = function<T extends SqlInsertTypeArgs>(
   table: SqlTable<T>,
   paramName?: string,
): SqlInsertValues<T, string> {
   return new SqlInsertValues<T, string>(table, paramName ?? "rows");
};

