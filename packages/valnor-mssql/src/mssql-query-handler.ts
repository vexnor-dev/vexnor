import { AsyncQueryHandler, isSqlRunOptions, RowOut, SqlQuery, SqlRunArgs, SqlValuesArgs } from "valnor";
import type { ConnectionPool, IResult } from "mssql";

// In mssql, the client is the connection pool
type MssqlClient = ConnectionPool;

export class MssqlQueryHandler<
    T extends { Row: RowOut; Params: Record<string, unknown> | undefined },
> extends AsyncQueryHandler<{
    Row: T["Row"];
    Params: T["Params"];
    QueryResult: IResult<T["Row"]>;
    Client: MssqlClient;
}> {
    constructor(readonly sqlQuery: SqlQuery<{ Row: T["Row"]; Params: T["Params"] }>) {
        super(sqlQuery);
    }

    getOptions(...args: SqlRunArgs<MssqlClient, T["Params"]>) {
        // eslint-disable-next-line unused-imports/no-unused-vars
        const [_, params] = args;
        const _args_: SqlValuesArgs<T["Params"]> = { params } as SqlValuesArgs<T["Params"]>;
        let queryInput = undefined;
        try {
            queryInput = {
                sql: this.sqlQuery.getSql(_args_),
                params: this.sqlQuery.getValues(_args_) as Record<string, any>,
            };
            return queryInput;
        } catch (err) {
            console.error(err, "\n", queryInput?.sql ?? "error building query");
            throw err;
        }
    }

    resolveRows(result: IResult<T["Row"]>): T["Row"][] {
        return result.recordset;
    }

    /**
     * Executes the query and returns the result
     * @param args
     */
    async run(...args: SqlRunArgs<MssqlClient, T["Params"]>): Promise<IResult<T["Row"]>> {
        const [opts] = args;
        const { db, debug } = isSqlRunOptions(opts) ? opts : { db: opts };
        let queryInput: { sql: string, params: Record<string, any> } | undefined = undefined;
        try {
            queryInput = this.getOptions(...args);
            if (debug) debug(Object.freeze(queryInput));
            const { sql, params } = queryInput;

            const request = db.request();
            if (params) {
                for (const key of Object.keys(params)) {
                    request.input(key, params[key]);
                }
            }
            return await request.query(sql);

        } catch (err) {
            console.error(err, "\n", queryInput?.sql ?? "error building query");
            throw err;
        }
    }
}
