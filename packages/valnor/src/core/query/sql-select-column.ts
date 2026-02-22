import { SqlBuildContext, SqlBuildOptions, SqlColumnTarget, SqlQueryAny } from "../query/index.js";
import { SqlSelectFormat } from "../default-formatter.js";
import { Sql, TYPE } from "../sql-base.js";

export interface SqlSelectColumnArgs<
   T extends {
      Key: string;
      Type: unknown;
   },
> {
   readonly key: T["Key"];
   readonly format?: SqlSelectFormat | null;
   readonly target: SqlColumnTarget<T>;
   readonly query: SqlQueryAny;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectColumnAny = SqlSelectColumn<any>;

export class SqlSelectColumn<
   T extends {
      Key: string;
      Type: unknown;
   },
> extends Sql {
   declare readonly [TYPE]: Record<T["Key"], T["Type"]>;

   readonly params = null;
   readonly key: T["Key"];
   readonly format: SqlSelectFormat | null = null;
   readonly target: SqlColumnTarget<T>;
   readonly query: SqlQueryAny;

   constructor({ key, format, target, query }: SqlSelectColumnArgs<T>) {
      super({
         id: `${query.id}/${target.id}`,
      });
      this.key = key;
      this.format = format ?? null;
      this.target = target;
      this.query = query;
   }

   as<Key extends string>(key: Key) {
      return new SqlSelectColumn({
         format: this.format,
         key,
         target: this.target,
         query: this.query,
      });
   }

   render(format: SqlSelectFormat) {
      return new SqlSelectColumn({
         format: format,
         key: this.key,
         target: this.target,
         query: this.query,
      });
   }

   build(context: SqlBuildContext, options?: SqlBuildOptions) {
      const tableInfo = (() => {
         const queryName = context.getQueryName(this);
         console.log(`SqlSelectColumn.build ${context.keyword ?? "...."} ${this.id}: ${queryName}`);
         return {
            name: queryName,
            alias: queryName,
         };
      })();

      const columnName = this.key;
      const format = this.format ?? context.formatter.getColumnFormat(context);
      switch (format) {
         case "tableName.columnName AS columnAlias": {
            if (this.key === columnName || !this.key) {
               context.addQuotes(`${tableInfo.name}.${columnName}`);
               break;
            }
            context.addQuotes(`${tableInfo.name}.${columnName} as ${this.key}`);
            break;
         }
         case "tableName.columnName":
            context.addQuotes(`${tableInfo.name}.${columnName}`);
            break;
         case "columnName":
            context.addQuotes(`${columnName}`);
            break;
         case "tableName.columnAlias":
            context.addQuotes(`${tableInfo.name}.${this.key ?? columnName}`);
            break;
         case "columnAlias":
            context.addQuotes(`${this.key ?? columnName}`);
            break;
         case "tableAlias.columnName":
            context.addQuotes(`${context.alias(tableInfo)}.${columnName}`);
            break;
         case "tableAlias.columnName AS columnAlias": {
            if (this.key === columnName || !this.key) {
               context.addQuotes(`${context.alias(tableInfo)}.${columnName}`);
               break;
            }

            context.addQuotes(`${context.alias(tableInfo)}.${columnName} as ${this.key}`);
            break;
         }
         case "(sql) AS columnAlias": {
            context.addStrings("(");
            context.scope({ query: this.query }, () => {
               this.query.build(context, options);
            });
            context.addStrings(`) as "${this.key}"`);
         }
      }
   }
}

export function newSqlSelectColumn<
   T extends {
      Key: string;
      Type: unknown;
   },
>(options: SqlSelectColumnArgs<T>): SqlSelectColumn<T> {
   return new SqlSelectColumn(options);
}
