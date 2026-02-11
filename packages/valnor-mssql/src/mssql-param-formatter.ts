import { SqlParamFormat } from "valnor";

/**
 * MSSQL parameter formatter
 * @param index
 * @param name
 * @constructor
 */
export const MssqlParamFormatter: SqlParamFormat = ({ index, name }: { index: number; name?: string }) =>
   `@param_${index}`;
