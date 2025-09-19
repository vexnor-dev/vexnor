import { SqlQuery } from "./sql-query.js";
import { RowOut } from "./sql-types.js";

export abstract class SqlQueryHandler<
   T extends { Row: RowOut; Params: Record<string, unknown> | undefined; QueryResult: object },
> {
   constructor(public readonly sqlQuery: SqlQuery<T>) {}

   abstract resolveRows(res: T["QueryResult"]): T["Row"][];
}
