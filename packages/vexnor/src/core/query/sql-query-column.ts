import { Sql, TYPE } from "#/core/sql-base.js";
import { SqlSelectFormat } from "#/core/builder/default-formatter.js";
import { SqlRowColumnTarget } from "#/core/query/sql-models.js";
import { SqlQueryAny } from "#/core/query/sql-query.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";
import { SqlQueryRefAny } from "#/core/query/sql-query-ref.js";
import { SqlJsonSchema } from "#/core/utils/sql-json-schema.js";

export type SqlQueryColumnTypeArgs = {
   Key: string;
   Type: unknown;
};

export type SqlQueryColumnArgs<T extends SqlQueryColumnTypeArgs> = Pick<SqlQueryColumn<T>, "key" | "target" | "query"> &
   Partial<Pick<SqlQueryColumn<T>, "format">>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryColumnAny = SqlQueryColumn<any>;

export class SqlQueryColumn<T extends SqlQueryColumnTypeArgs> extends Sql {
   declare readonly [TYPE]: Record<T["Key"], T["Type"]>;

   readonly params = null;
   readonly key: T["Key"];
   readonly format: SqlSelectFormat | null = null;
   readonly target: SqlRowColumnTarget<T>;
   readonly query: SqlQueryAny | SqlQueryRefAny;

   constructor({ key, format, target, query }: SqlQueryColumnArgs<T>) {
      super({
         type: "SqlQueryColumn",
         id: `${query.id}/${target.id}`,
         hashId: target.hashId,
      });
      this.key = key;
      this.format = format ?? null;
      this.target = target;
      this.query = query;
   }

   get jsonSchema(): SqlJsonSchema {
      const inner = this.target.jsonSchema;
      const value = inner[this.target.key];
      if (!value) return {};
      if (this.key === this.target.key) return inner;
      return { [this.key]: value };
   }

   /**
    * Returns a copy of this column reference with a different result key.
    *
    * Use this when selecting a subquery column into a parent query under a
    * different property name.
    *
    * @param key - The new result key.
    *
    * @example
    * sql`
    *   SELECT ${row(
    *     Account.$$,
    *     AccountChildren.row.$accountId.as("childId"),
    *     AccountChildren.row.$email.as("childEmail")
    *   )}
    *   FROM ${Account}
    *   JOIN LATERAL (${AccountChildren}) children ON true
    * `
    * // result includes: { ..., childId: string, childEmail: string }
    */
   as<Key extends string>(key: Key) {
      return new SqlQueryColumn({
         format: this.format,
         key,
         target: this.target,
         query: this.query,
      });
   }

   render(format: SqlSelectFormat) {
      return new SqlQueryColumn({
         format: format,
         key: this.key,
         target: this.target,
         query: this.query,
      });
   }

   write(context: SqlBuildContext, options?: SqlBuildOptions) {
      const queryInfo = (() => {
         const queryName = context.getQueryName(this);
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
               context.addQuotes(`${queryInfo.name}.${columnName}`);
               break;
            }
            context.addQuotes(`${queryInfo.name}.${columnName} as ${this.key}`);
            break;
         }
         case "tableName.columnName":
            context.addQuotes(`${queryInfo.name}.${columnName}`);
            break;
         case "columnName":
            context.addQuotes(`${columnName}`);
            break;
         case "tableName.columnAlias":
            context.addQuotes(`${queryInfo.name}.${this.key ?? columnName}`);
            break;
         case "columnAlias":
            context.addQuotes(`${this.key ?? columnName}`);
            break;
         case "tableAlias.columnName":
            context.addQuotes(`${context.getAlias(queryInfo)}.${columnName}`);
            break;
         case "tableAlias.columnName AS columnAlias": {
            if (this.key === columnName || !this.key) {
               context.addQuotes(`${context.getAlias(queryInfo)}.${columnName}`);
               break;
            }

            context.addQuotes(`${context.getAlias(queryInfo)}.${columnName} as ${this.key}`);
            break;
         }
         case "(sql) AS columnAlias": {
            context.addStrings("(");
            this.query.build(context, options, { queryType: "main" });
            context.addStrings(`) as "${this.key}"`);
         }
      }
   }
}

export function newSqlQueryColumn<T extends SqlQueryColumnTypeArgs>(options: SqlQueryColumnArgs<T>): SqlQueryColumn<T> {
   return new SqlQueryColumn(options);
}
