import { SqlTableCrudConfig } from "#/core/crud/sql-table-crud-config.js";
import { InferTable$RowBySelect } from "#/core/types/infer-types.js";
import { Sql } from "#/core/sql-base.js";
import { SqlTableIdentity } from "#/core/schema/sql-table-identity.js";
import { SqlTableFormat } from "#/core/builder/default-formatter.js";
import { Lazy } from "#/lib/lazy.js";
import { SqlTableAll } from "#/core/charms/sql-table-all.js";
import { newSqlTableColumn, SqlTableColumnAny } from "#/core/schema/sql-table-column.js";
import { ok } from "#/lib/assert.js";
import { TableUpdateSet } from "#/core/charms/table-update-set.js";
import { TableInsertValues } from "#/core/charms/table-insert-values.js";
import { TableInsertCols } from "#/core/charms/table-insert-cols.js";
import { TableInsertRows } from "#/core/charms/table-insert-rows.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";
import { CACHE } from "#/lib/cache.js";

export type SqlTableOptions<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
> = { readonly columns: Record<keyof T["Select"], string> } & Pick<SqlTable<T>, "tableInfo" | "pk"> &
   Partial<Pick<SqlTable<T>, "format" | "dialect">> & { crud: SqlTableCrudConfig<T> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableAny = SqlTable<any>;

export type SqlTableRow<
   T extends {
      Select: Record<string, unknown>;
   },
> = InferTable$RowBySelect<T["Select"]> & {
   (strings: TemplateStringsArray): SqlTableExtended<T>;
};

export type SqlTableExtended<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
> = SqlTable<T> & SqlTableRow<T>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableExtendedAny = SqlTableExtended<any>;

export class SqlTable<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
> extends Sql {
   readonly tableInfo: SqlTableIdentity;
   readonly format: SqlTableFormat | null;
   readonly pk: Array<keyof T["Select"]>;
   readonly dialect: string;

   // TODO: ideas for later: onBeforeInsert|onBeforeUpdate|onAfterInsert|onAfterUpdate  ((T) => T) ?
   // readonly onInsert?: T["Insert"] extends Record<string, unknown> ? (value: T["Insert"]) => T["Insert"] : boolean;
   // readonly onUpdate?: T["Update"] extends Record<string, unknown> ? (value: T["Update"]) => T["Update"] : boolean;

   private readonly _cols: Lazy<InferTable$RowBySelect<T["Select"]>>;
   private readonly _out: Lazy<InferTable$RowBySelect<T["Select"]>>;
   private readonly _$$: Lazy<SqlTableAll<T["Select"]>>;
   private readonly _crudConfig: SqlTableCrudConfig<T>;

   constructor(args: SqlTableOptions<T> | SqlTable<T>) {
      const { format, pk, tableInfo, crud, dialect } = args;
      super({
         id: (() => {
            const schema = tableInfo.schema ? `${tableInfo.schema}.` : "";
            const alias = tableInfo.alias ? ` as ${tableInfo.alias}` : "";
            return `SqlTable(${schema}${tableInfo.name}${alias})`;
         })(),
      });
      this.tableInfo = tableInfo;
      this.format = format ?? null;
      this.pk = pk;
      this.dialect = dialect || "sql";
      this._$$ = new Lazy(() => new SqlTableAll<T["Select"]>(this.cols));
      this._crudConfig = crud;

      switch (true) {
         case args instanceof SqlTable:
            this._cols = new Lazy(() => args.cols);
            this._out = new Lazy(() => args.out);
            break;
         default: {
            const { columns } = args;
            this._cols = new Lazy(() => this.initCols(columns));
            this._out = new Lazy(() => this.initOut(columns));
         }
      }
   }

   get cols(): InferTable$RowBySelect<T["Select"]> {
      return this._cols.value;
   }

   get out(): InferTable$RowBySelect<T["Select"]> {
      return this._out.value;
   }

   /** Selects all columns from this table — equivalent to `SELECT *` but fully typed. */
   get $$(): SqlTableAll<T["Select"]> {
      return this._$$.value;
   }

   get crud(): SqlTableCrudConfig<T> {
      return this._crudConfig;
   }

   /**
    * Returns a new aliased version of this table for use in self-joins or
    * when the same table appears more than once in a query.
    *
    * @param tableName - The SQL alias to apply.
    *
    * @example
    * const Parent = Account.as("parent");
    *
    * sql`
    *   SELECT ${row(Account.$$, Parent.$email.as("parentEmail"))}
    *   FROM ${Account}
    *   JOIN ${Parent} ON ${Parent.$accountId} = ${Account.$parentId}
    * `
    */
   as(tableName: string | TemplateStringsArray): SqlTableExtended<T> {
      const alias = (() => {
         switch (true) {
            case typeof tableName === "string":
               return tableName;
            case Array.isArray(tableName) && tableName.length === 1:
               return tableName[0];
            default:
               throw new Error(`Invalid table name: ${tableName}`);
         }
      })();

      return CACHE.get([this.id, `alias=${alias}`], () =>
         newSqlTable({
            format: this.format,
            pk: this.pk,
            dialect: this.dialect,
            columns: (() => {
               const columns: Record<string, string> = {};
               for (const { key, columnName } of Object.values(this.cols)) {
                  columns[key] = columnName;
               }

               return columns as Record<keyof T["Select"], string>;
            })(),
            tableInfo: { ...this.tableInfo, alias },
            crud: this._crudConfig,
         }),
      );
   }

   column(key: string): SqlTableColumnAny {
      const result = this.cols[key as keyof T["Select"]];
      if (!result) throw new Error(`Column not found: ${this.tableInfo.name}.${String(key)}`);

      return result as unknown as SqlTableColumnAny;
   }

   /**
    * Generates the `SET col1 = ?, col2 = ?` clause for an UPDATE statement.
    *
    * @param update - An object containing the columns and values to update.
    *
    * @example
    * sql`
    *   UPDATE ${Account}
    *   SET ${Account.updateSet({ firstName: "Jane", email: "jane@example.com" })}
    *   WHERE ${Account.$accountId} = ${accountId}
    *   RETURNING ${row(Account.$$)}
    * `
    */
   updateSet<U extends T["Update"]>(update: U): T["Update"] extends undefined ? never : Sql {
      ok(update, `Update is required`);
      ok(Object.keys(update), `Update doesn't have any values`);
      return new TableUpdateSet(this.cols, update) as unknown as T["Update"] extends undefined ? never : Sql;
   }

   /**
    * Generates the `("col1", "col2") VALUES (?, ?), (?, ?)` clause for an INSERT statement.
    *
    * Accepts one or more insert objects. All objects must share the same set of keys.
    *
    * @param inserts - One or more objects containing the data to insert.
    *
    * @example
    * // Single row
    * sql`INSERT INTO ${Account} ${Account.insertColsVals({ firstName: "John", email: "john@example.com" })}`
    *
    * @example
    * // Batch insert
    * sql`
    *   INSERT INTO ${Account}
    *   ${Account.insertColsVals(
    *     { firstName: "John", email: "john@example.com" },
    *     { firstName: "Jane", email: "jane@example.com" }
    *   )}
    *   RETURNING ${row(Account.$$)}
    * `
    */
   insertColsVals(...inserts: T["Insert"][]): T["Insert"] extends undefined ? never : Sql {
      ok(insertsAreValid(inserts), `Invalid inserts`);
      return new TableInsertValues(this.cols, inserts) as never as T["Insert"] extends undefined ? never : Sql;
   }

   /**
    * Generates only the column list `("col1", "col2")` for an INSERT statement.
    *
    * Use together with `insertVals()` when you need to separate the column list
    * from the values clause (e.g. for INSERT ... SELECT patterns).
    *
    * @param inserts - One or more objects whose keys determine the column list.
    */
   insertCols(...inserts: T["Insert"][]): T["Insert"] extends undefined ? never : Sql {
      ok(insertsAreValid(inserts), `Invalid inserts`);
      return new TableInsertCols(this.cols, inserts) as never as T["Insert"] extends undefined ? never : Sql;
   }

   /**
    * Generates only the `VALUES (?, ?), (?, ?)` clause for an INSERT statement.
    *
    * Use together with `insertCols()` when you need to separate the column list
    * from the values clause (e.g. for INSERT ... SELECT patterns).
    *
    * @param inserts - One or more objects containing the data to insert.
    */
   insertVals(...inserts: T["Insert"][]): T["Insert"] extends undefined ? never : Sql {
      ok(insertsAreValid(inserts), `Invalid inserts`);
      return new TableInsertRows(this.cols, inserts) as never as T["Insert"] extends undefined ? never : Sql;
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   write(context: SqlBuildContext, _options?: SqlBuildOptions) {
      const schema = this.tableInfo.schema ? `${this.tableInfo.schema}.` : "";

      const format = this.format ?? context.formatter.getTableFormat(context);
      switch (format) {
         case "tableName":
            context.addQuotes(`${this.tableInfo.name}`);
            break;
         case "schema.tableName":
            context.addQuotes(`${schema}${this.tableInfo.name}`);
            switch (context.keyword) {
               case "update":
               case "delete from":
               case "insert into":
                  context.setAlias(this.tableInfo, { alias: this.tableInfo.name });
            }
            break;
         case "schema.tableName AS tableAlias": {
            const alias = this.tableInfo.alias ?? context.getAlias(this.tableInfo);
            if (this.tableInfo.name === alias) {
               context.addQuotes(`${schema}${this.tableInfo.name}`);
               break;
            }

            context.addQuotes(`${schema}${this.tableInfo.name} as ${alias}`);
            break;
         }
         case "tableAlias":
            context.addQuotes(`${context.getAlias(this.tableInfo)}`);
            break;
         default:
            throw new Error(`Unknown table format: ${format}`);
      }
   }

   render(format: SqlTableFormat): SqlTableExtended<T> {
      return CACHE.get([this.id, `format=${format}`], () =>
         newSqlTable({
            format,
            tableInfo: this.tableInfo,
            pk: this.pk,
            dialect: this.dialect,
            columns: (() => {
               const columns: Record<string, string> = {};
               for (const { key, columnName } of Object.values(this.cols)) {
                  columns[key] = columnName;
               }

               return columns as Record<keyof T["Select"], string>;
            })(),
            crud: this._crudConfig,
         }),
      );
   }

   private initCols(columns: Record<keyof T["Select"], string>): InferTable$RowBySelect<T["Select"]> {
      const { schema, name } = this.tableInfo;
      let cols: Partial<InferTable$RowBySelect<T["Select"]>> = {};
      for (const [key, value] of Object.entries(columns)) {
         if (typeof value === "string") {
            cols = {
               ...(cols ?? {}),
               [`$${key}`]: newSqlTableColumn({ key: key, columnName: value, tableInfo: this.tableInfo }),
            };
         } else {
            throw new Error(`Column ${schema}.${name} ${key} must be a string`);
         }
      }
      return cols as InferTable$RowBySelect<T["Select"]>;
   }

   private initOut(columns: Record<keyof T["Select"], string>): InferTable$RowBySelect<T["Select"]> {
      const { schema, name } = this.tableInfo;
      let out: Partial<InferTable$RowBySelect<T["Select"]>> = {};
      for (const [key, value] of Object.entries(columns)) {
         if (typeof value === "string") {
            out = {
               ...(out ?? {}),
               [`$${key}`]: newSqlTableColumn({
                  key: key,
                  columnName: value,
                  tableInfo: { ...this.tableInfo, out: true },
               }),
            };
         } else {
            throw new Error(`Column ${schema}.${name} ${key} must be a string`);
         }
      }
      return out as InferTable$RowBySelect<T["Select"]>;
   }
}

export function newSqlTable<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Partial<T["Select"]>;
      Update?: Partial<T["Select"]>;
      Delete?: boolean;
   },
   Extra extends Record<string, unknown> = Record<string, unknown>,
>(options: SqlTableOptions<T>, extra?: Extra): SqlTableExtended<T> & Extra {
   return newSqlTableProxy(new SqlTable(options), extra);
}

export function newSqlTableProxy<
   T extends { Select: Record<string, unknown> },
   Table extends SqlTable<T>,
   Extra extends Record<string, unknown> = Record<string, unknown>,
>(table: Table, extra?: Extra): Table & SqlTableRow<T> & Extra {
   return new Proxy(table, {
      ownKeys(target): ArrayLike<string | symbol> {
         const extraKeys = extra ? Object.keys(extra) : [];
         return [...Object.keys(target), ...Object.keys(target.cols), ...extraKeys];
      },
      getOwnPropertyDescriptor(target, p: string | symbol): PropertyDescriptor | undefined {
         if (Reflect.has(target, p)) {
            return Reflect.getOwnPropertyDescriptor(target, p);
         }

         if (Reflect.has(target.cols, p)) {
            return Reflect.getOwnPropertyDescriptor(target.cols, p);
         }

         if (extra && Reflect.has(extra, p)) {
            return Reflect.getOwnPropertyDescriptor(extra, p);
         }
      },
      has(target, p: string | symbol): boolean {
         const hasExtra = extra ? Reflect.has(extra, p) : false;
         return Reflect.has(target, p) || Reflect.has(target.cols, p) || hasExtra;
      },
      get(target, p: string | symbol, receiver: unknown): unknown {
         if (Reflect.has(target, p)) {
            return Reflect.get(target, p, receiver);
         }

         if (Reflect.has(target.cols, p)) {
            return Reflect.get(target.cols, p, receiver);
         }

         if (extra && Reflect.has(extra, p)) {
            return Reflect.get(extra, p, receiver);
         }
      },
   }) as Table & SqlTableRow<T> & Extra;
}

function insertsAreValid(values: unknown[]): values is Record<string, unknown>[] {
   if (!values.length) return false;
   return !values.some((value) => !value);
}
