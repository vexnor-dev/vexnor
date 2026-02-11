import { QueryParams, SqlQueryToken } from "../sql.js";
import { PARAMS, TYPE, Sql, ROW } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlBuildOptions } from "./sql-query-types.js";
import { SqlQuery, SqlQueryAny } from "./sql-query.js";
import { SqlQueryInfo } from "../charms/index.js";
import { quote } from "../utils/index.js";
import { SqlBuildError } from "../sql-build-error.js";
import { RowType, SqlQueryRow, ValueTypeOf } from "./sql-models.js";
import { BuildSqlParams } from "./sql-param.js";
import { newSqlSelectColumn } from "./sql-select-column.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectValueAny = SqlSelectValue<any>;

export type SqlSelectValueArgs<T extends { Key: string; Type: unknown; Params?: unknown }> = {
   query: SqlQuery<{ Params: T["Params"] }>;
   key: T["Key"];
   build?: (context: SqlBuildContext, options?: SqlBuildOptions) => void;
};

export class SqlSelectValue<T extends { Key: string; Type: unknown; Params?: unknown }> extends Sql {
   declare readonly [ROW]: Record<T["Key"], T["Type"]>;
   declare readonly [TYPE]: Record<T["Key"], T["Type"]>;
   declare readonly [PARAMS]: T["Params"];

   readonly params: BuildSqlParams<T["Params"]>;

   readonly query: SqlQuery<{ Params: T["Params"] }>;
   readonly key: T["Key"];
   readonly _build: null | ((context: SqlBuildContext, options?: SqlBuildOptions) => void);
   readonly row: SqlQueryRow<Record<T["Key"], T["Type"]>>;

   constructor({ query, key, build }: SqlSelectValueArgs<T>) {
      super({
         ID: `${query.rawStrings[0]} ... as ${String(key)}`,
      });
      this.query = query;
      this.key = key;
      this._build = build ?? null;
      this.params = query.params;
      this.row = {
         [`$${key}`]: newSqlSelectColumn({
            key,
            columnName: key,
         }),
      } as SqlQueryRow<Record<T["Key"], T["Type"]>>;
   }

   build(context: SqlBuildContext, options?: SqlBuildOptions): void {
      if (this._build) {
         this._build(context, options);
      } else {
         this.query.build(context, options);
         context.addStrings(` as ${quote(String(this.key))}`);
      }
   }
}

export function val<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray | SqlQueryAny,
   ...rawValues: Tokens
) {
   return {
      as: <Row extends Record<string, unknown>>(
         rowType: RowType<Row>,
      ): SqlSelectValue<{
         Key: Extract<keyof Row, string>;
         Type: ValueTypeOf<(typeof rowType)[keyof Row]>;
         Params: QueryParams<typeof rawValues>;
      }> => {
         const key = Object.keys(rowType)[0] as Extract<keyof Row, string> | undefined;
         if (!key) throw new SqlBuildError(`No key found in row type: ${rowType}`);
         switch (true) {
            case rawStrings instanceof SqlQuery:
               return new SqlSelectValue({ query: rawStrings, key });
            case Array.isArray(rawStrings): {
               const query = new SqlQuery<{ Params: QueryParams<typeof rawValues> }>({
                  rawStrings: rawStrings,
                  rawValues,
                  isFragment: true,
                  info: new SqlQueryInfo({ label: String(rowType) }),
               });
               return new SqlSelectValue({
                  query,
                  key,
               });
            }
            default:
               throw new SqlBuildError(`Args unknown or not supported: ${rawStrings}`);
         }
      },
   };
}
