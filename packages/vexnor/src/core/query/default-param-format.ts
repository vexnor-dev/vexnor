import { SqlParamFormat } from "#/core/query/sql-models.js";

const defaultParamFormatByDialect: Record<string, SqlParamFormat> = {
   transactsql: ({ index }) => `@param_${index}`,
   tsql: ({ index }) => `@param_${index}`,
   postgresql: ({ index }) => `$${index + 1}`,
};

const defaultParamFormat: SqlParamFormat = () => "?";

export function getDefaultParamFormat(dialect: string): SqlParamFormat {
   return defaultParamFormatByDialect[dialect] ?? defaultParamFormat;
}
