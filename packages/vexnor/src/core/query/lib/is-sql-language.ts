import { SqlLanguage, supportedDialects } from "sql-formatter";

export function isSqlLanguage(value: string): value is SqlLanguage {
   return supportedDialects.includes(value);
}
