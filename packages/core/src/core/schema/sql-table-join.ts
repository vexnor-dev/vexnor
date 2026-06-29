import { SqlTable, SqlTableAny, SqlTableTypeArgs, type SqlJoinType } from "#src/core/schema/sql-table.js";
import { SqlSelectArgs, sqlSelect, SqlSelectResult } from "#src/core/crud/sql-select.js";
import { SqlQueryInfo } from "#src/core/charms/sql-query-info.js";

/**
 * Builder returned by SqlTable.join({ alias: Table }).
 * Carries the joined table alias map so .select() can produce fully typed Params.
 */
export class SqlTableJoin<
   T extends SqlTableTypeArgs,
   M extends Record<string, SqlTableAny>,
> {
   constructor(
      readonly rootTable: SqlTable<T>,
      readonly joinMap: M,
      readonly joinTypes: Record<string, SqlJoinType> = {},
   ) {}

   select<Args extends SqlSelectArgs<T>>(
      args: Args,
      info?: SqlQueryInfo | null,
   ): SqlSelectResult<T, Args, M> {
      return sqlSelect(this.rootTable, args, info, this.joinMap, this.joinTypes);
   }
}
