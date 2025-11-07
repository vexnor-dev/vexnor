import { SqlQuery } from "./sql-query.js";

export interface SqlCharm<T extends { Row?: unknown; Params?: unknown }> {
   query: SqlQuery<T>;
}
