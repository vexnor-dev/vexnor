import { SQL_LANGUAGES, type SqlLanguage } from "#/format/sql-language.js";

export function isSqlLanguage(value: string): value is SqlLanguage {
   return SQL_LANGUAGES.has(value);
}
