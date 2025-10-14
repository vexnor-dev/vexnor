import { SqlQuery } from "./sql-query.js";
import { Params, RowOut } from "../sql-types.js";

export abstract class SqlQueryHandler<T extends { Row: RowOut; Params?: Params; QueryResult: object }> {
   constructor(public readonly sqlQuery: SqlQuery<T>) {}

   abstract resolveRows(res: T["QueryResult"]): T["Row"][];
}
