import { DefaultFormatter } from "#src/core/builder/default-formatter.js";
import { DefaultTokenizer } from "#src/core/builder/default-tokenizer.js";
import { type SqlLanguage } from "#src/format/sql-language.js";
import { SqlParamFormat } from "#src/core/query/sql-models.js";

/**
 * Options that control how a query is built and formatted.
 *
 * Pass via the `options` field on any execution method or `getSql()`.
 *
 * - `debug` — called with the final `{ text, values }` before execution; useful for logging
 * - `format` — `true`: always format (throws if no formatter registered), `false`: never format, `'auto'` (default): format if formatter registered
 * - `dialect` — override the SQL dialect used for formatting (inferred from the plugin by default)
 * - `paramFormat` — override how parameter placeholders are rendered (e.g. `$1`, `?`)
 */
export interface SqlBuildOptions {
   formatter?: DefaultFormatter;
   tokenizer?: DefaultTokenizer;
   onAddString?: (text: string) => string;
   debug?: (args: Readonly<Record<string, unknown>>) => void;
   dialect?: SqlLanguage;
   paramFormat?: SqlParamFormat;
   format?: boolean | "auto";
   /** Emit `/* <query_N> *\/` boundary comments around each query fragment. Defaults to `false`. */
   boundaryComments?: boolean;
}

/** Global build defaults — mutable at app start via `sql.config`. */
export const sqlBuildDefaults: Pick<SqlBuildOptions, "boundaryComments"> = {
   boundaryComments: false,
};
