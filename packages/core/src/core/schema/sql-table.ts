import { SqlTableCrudConfig } from "#src/core/crud/sql-table-crud-config.js";
import { InferTable$RowBySelect } from "#src/core/types/infer-types.js";
import { Sql } from "#src/core/sql-base.js";
import { SqlTableIdentity } from "#src/core/schema/sql-table-identity.js";
import { SqlTableFormat } from "#src/core/builder/default-formatter.js";
import { Lazy } from "#src/lib/lazy.js";
import { SqlTableAll } from "#src/core/charms/sql-table-all.js";
import { newSqlTableColumn, SqlTableColumn, SqlTableColumnAny } from "#src/core/schema/sql-table-column.js";
import { SqlTableJoin } from "#src/core/schema/sql-table-join.js";

import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#src/core/builder/sql-build-options.js";
import { CACHE, registerResetHook } from "#src/lib/cache.js";
import { SqlJsonType } from "#src/core/utils/sql-json-schema.js";
import { SqlLiteralType } from "#src/plugin/sql-literal.js";

export const TABLE: unique symbol = Symbol("TABLE");
export type TableOf<S> = S extends { readonly [TABLE]?: infer R } ? R : void;

export type SqlTableTypeArgs = {
   Select: Record<string, unknown>;
   Insert?: Record<string, unknown>;
   Update?: Record<string, unknown>;
   Delete?: boolean;
};

export type SqlJoinType = "inner" | "left" | "right" | "full" | "cross";

/** Extracts the SqlTableAny from a join map value (either bare table or [Table, kind] tuple). */
export type ExtractJoinTables<M extends Record<string, SqlTableAny | [SqlTableAny, SqlJoinType]>> = {
   [K in keyof M]: M[K] extends [infer T, SqlJoinType] ? T extends SqlTableAny ? T : never : M[K] extends SqlTableAny ? M[K] : never;
};

export type SqlTableForeignKey = {
   from: string[];
   to: { schema: string; table: string; columns: string[] };
};

export type SqlTableDbColumnSchema = {
   dbType: string;
   type: SqlLiteralType;
   nullable?: boolean;
   default?: string;
   values?: string[];
};

export type SqlTableOptions<T extends SqlTableTypeArgs> = {
   readonly columns: Record<keyof T["Select"], string>;
   readonly jsonSchema?: Partial<Record<keyof T["Select"], SqlJsonType>>;
   readonly fk?: SqlTableForeignKey[];
   readonly dbSchema?: Partial<Record<keyof T["Select"], SqlTableDbColumnSchema>>;
} & Pick<SqlTable<T>, "tableInfo" | "pk"> &
   Partial<Pick<SqlTable<T>, "format" | "dialect" | "source">> & { crud: SqlTableCrudConfig<T> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableAny = SqlTable<any>;

export type SqlTableRow<
   T extends {
      Select: Record<string, unknown>;
   },
> = InferTable$RowBySelect<T["Select"]> & {
   (strings: TemplateStringsArray): SqlTableExtended<T>;
};

export type SqlTableExtended<T extends SqlTableTypeArgs> = SqlTable<T> & SqlTableRow<T>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableExtendedAny = SqlTableExtended<any>;

export class SqlTable<T extends SqlTableTypeArgs> extends Sql {
   declare readonly [TABLE]?: typeof this.tableInfo.name;

   private static registry = new Map<string, SqlTableAny>();
   private static _connections = new Map<string, SqlTableForeignKey[]>();
   readonly tableInfo: SqlTableIdentity;
   readonly format: SqlTableFormat | null;
   readonly pk: Array<keyof T["Select"]>;
   readonly dialect: string;
   readonly source: string;
   readonly columnTypes: Partial<Record<keyof T["Select"], SqlJsonType>>;
   private readonly _fk: Lazy<SqlTableForeignKey[]>;
   readonly dbSchema: Partial<Record<keyof T["Select"], SqlTableDbColumnSchema>>;
   private readonly _cols: Lazy<InferTable$RowBySelect<T["Select"]>>;
   private readonly _out: Lazy<InferTable$RowBySelect<T["Select"]>>;
   private readonly _$$: Lazy<SqlTableAll<T["Select"]>>;

   // TODO: ideas for later: onBeforeInsert|onBeforeUpdate|onAfterInsert|onAfterUpdate  ((T) => T) ?
   // readonly onInsert?: T["Insert"] extends Record<string, unknown> ? (value: T["Insert"]) => T["Insert"] : boolean;
   // readonly onUpdate?: T["Update"] extends Record<string, unknown> ? (value: T["Update"]) => T["Update"] : boolean;
   private readonly _crudConfig: SqlTableCrudConfig<T>;

   constructor(args: SqlTableOptions<T> | SqlTable<T>) {
      const { format, pk, tableInfo, crud, dialect } = args;
      super({
         type: "SqlTable",
         ...(() => {
            let hashId = "";
            if (tableInfo.schema) hashId += `${tableInfo.schema}.`;

            hashId += tableInfo.name;
            if (tableInfo.alias) hashId += ` as ${tableInfo.alias}`;

            return {
               hashId,
               id: hashId,
            };
         })(),
      });
      this.tableInfo = tableInfo;
      this.format = format ?? null;
      this.pk = pk;
      this.dialect = dialect || "sql";
      this.source = (args instanceof SqlTable ? args.source : args.source) ?? "";
      this.columnTypes = (args instanceof SqlTable ? args.columnTypes : args.jsonSchema) ?? {};
      const codegenFk: SqlTableForeignKey[] = (args instanceof SqlTable ? args.fk : args.fk) ?? [];
      const fkKey = `${tableInfo.schema}.${tableInfo.name}`;
      this._fk = new Lazy(() => [...codegenFk, ...(SqlTable._connections.get(fkKey) ?? [])]);
      this.dbSchema = (args instanceof SqlTable ? args.dbSchema : args.dbSchema) ?? {};
      this._$$ = new Lazy(() => new SqlTableAll<T["Select"]>(this.cols));
      this._crudConfig = crud;

      switch (true) {
         case args instanceof SqlTable:
            this._cols = new Lazy(() => args.cols);
            this._out = new Lazy(() => args.out);
            break;
         default: {
            const { columns, jsonSchema = {} } = args;
            this._cols = new Lazy(() => this.initCols(columns, jsonSchema));
            this._out = new Lazy(() => this.initOut(columns, jsonSchema));
         }
      }
   }

   get colKeys(): Extract<keyof T["Select"], string>[] {
      return Object.values(this.cols).map((z) => z.key) as Extract<keyof T["Select"], string>[];
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

   static resolve({
      source,
      schema,
      table,
   }: {
      source: string;
      schema: string;
      table: string;
   }): SqlTableAny | undefined {
      return SqlTable.registry.get(`${source}:${schema}.${table}`);
   }

   static clearRegistry(): void {
      SqlTable.registry.clear();
      SqlTable._connections.clear();
   }

   static register(table: SqlTableAny): void {
      if (table.source && !table.tableInfo.alias) {
         SqlTable.registry.set(`${table.source}:${table.tableInfo.schema}.${table.tableInfo.name}`, table);
      }
   }

   get fk(): SqlTableForeignKey[] {
      return this._fk.value;
   }

   /**
    * Defines a logical FK relationship between two tables for auto-join path resolution.
    * Must be called BEFORE the source table's FK list is evaluated.
    * Throws if the source table's lazy FK has already been built.
    *
    * @note This must run before any code reads `.fk` on the source table.
    * In practice, call `connect()` in a dedicated connections file that is imported
    * before any code that uses `.fk` (e.g., before auto-join resolution or codegen).
    *
    * @param source - The table that holds the FK column: `{ table, fields: [col] }`
    * @param target - The table being referenced: `{ table, fields: [col] }`
    *
    * @example
    * SqlTable.connect(
    *   { table: Payment, fields: [Payment.$customerId] },
    *   { table: Customer, fields: [Customer.$customerId] },
    * );
    */
   static connect(
      source: { table: SqlTableAny; fields: SqlTableColumnAny[] },
      target: { table: SqlTableAny; fields: SqlTableColumnAny[] },
   ): void {
      const srcTable = source.table as SqlTable<SqlTableTypeArgs>;
      if (srcTable._fk.computed) {
         throw new Error(
            `SqlTable.connect(): Cannot add relationships to "${srcTable.tableInfo.name}" — FK list has already been evaluated. ` +
            `Call SqlTable.connect() before any code reads .fk (e.g. before auto-join resolution).`,
         );
      }
      const fk: SqlTableForeignKey = {
         from: source.fields.map((f) => f.key),
         to: {
            schema: target.table.tableInfo.schema ?? "",
            table: target.table.tableInfo.name,
            columns: target.fields.map((f) => f.key),
         },
      };
      const key = `${source.table.tableInfo.schema}.${source.table.tableInfo.name}`;
      const existing = SqlTable._connections.get(key);
      if (existing) {
         existing.push(fk);
      } else {
         SqlTable._connections.set(key, [fk]);
      }
   }

   /** Resolves a foreign key reference to the target SqlTable instance via the static registry. */
   resolveFk(fk: SqlTableForeignKey): SqlTableAny | undefined {
      return SqlTable.resolve({ source: this.source, schema: fk.to.schema, table: fk.to.table });
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
            jsonSchema: this.columnTypes,
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

   column<Key extends Extract<keyof T["Select"], string>>(
      key: Key,
   ): SqlTableColumn<{ Key: Key; Type: T["Select"][Key] }> {
      const colKey = key.includes(".") ? key.slice(key.indexOf(".") + 1) : key;
      const lookup = colKey.startsWith("$") ? colKey : `$${colKey}`;
      const result = this.cols[lookup as keyof T["Select"]];
      if (!result) throw new Error(`Column not found: ${this.tableInfo.name}.${String(key)}`);

      return result as unknown as SqlTableColumnAny;
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
            jsonSchema: this.columnTypes,
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

   /**
    * Declares joined tables for typed filterBy/orderBy/select dot-notation columns.
    * Returns a builder whose .select() method has fully typed Params including joined columns.
    *
    * @example
    * Order.join({ account: Account }).select({}).all({
    *   db,
    *   params: {
    *     joinBy: { account: [["accountId", "accountId"]] },
    *     filterBy: [{ "account.email": "test@example.com" }],
    *     orderBy: { "account.lastName": "ASC" },
    *   }
    * })
    *
    * // With explicit join kinds:
    * Payment.join({
    *   customer: Customer,
    *   city: [City, "left"],
    * })
    */
   join<const M extends Record<string, SqlTableAny | [SqlTableAny, SqlJoinType]>>(
      map: M,
   ): SqlTableJoin<T, ExtractJoinTables<M>> {
      // Normalize map: extract tables from tuples, auto-alias self-joins
      const normalized: Record<string, SqlTableAny> = {};
      const types: Record<string, SqlJoinType> = {};
      const seen = new Set<SqlTableAny>([this as unknown as SqlTableAny]);
      for (const [key, value] of Object.entries(map)) {
         const table = (Array.isArray(value) ? value[0] : value) as SqlTableAny;
         if (Array.isArray(value)) {
            types[key] = value[1] as SqlJoinType;
         }
         // If this table was already used (self-join or same table twice), create an alias
         normalized[key] = seen.has(table) ? table.as(key) : table;
         seen.add(table);
      }
      return new SqlTableJoin(this, normalized as ExtractJoinTables<M>, types);
   }

   private initCols(
      columns: Record<keyof T["Select"], string>,
      columnTypes: Partial<Record<keyof T["Select"], SqlJsonType>>,
   ): InferTable$RowBySelect<T["Select"]> {
      const { schema, name } = this.tableInfo;
      let cols: Partial<InferTable$RowBySelect<T["Select"]>> = {};
      for (const [key, value] of Object.entries(columns)) {
         if (typeof value === "string") {
            cols = {
               ...(cols ?? {}),
               [`$${key}`]: newSqlTableColumn({
                  key,
                  columnName: value,
                  tableInfo: this.tableInfo,
                  jsonType: columnTypes[key] ?? null,
               }),
            };
         } else {
            throw new Error(`Column ${schema}.${name} ${key} must be a string`);
         }
      }
      return cols as InferTable$RowBySelect<T["Select"]>;
   }

   private initOut(
      columns: Record<keyof T["Select"], string>,
      columnTypes: Partial<Record<keyof T["Select"], SqlJsonType>>,
   ): InferTable$RowBySelect<T["Select"]> {
      const { schema, name } = this.tableInfo;
      let out: Partial<InferTable$RowBySelect<T["Select"]>> = {};
      for (const [key, value] of Object.entries(columns)) {
         if (typeof value === "string") {
            out = {
               ...(out ?? {}),
               [`$${key}`]: newSqlTableColumn({
                  key,
                  columnName: value,
                  tableInfo: { ...this.tableInfo, out: true },
                  jsonType: columnTypes[key] ?? null,
               }),
            };
         } else {
            throw new Error(`Column ${schema}.${name} ${key} must be a string`);
         }
      }
      return out as InferTable$RowBySelect<T["Select"]>;
   }
}

registerResetHook(() => SqlTable.clearRegistry());

export function newSqlTable<
   T extends {
      Select: Record<string, unknown>;
      Insert?: { [K in keyof T["Select"]]?: unknown };
      Update?: { [K in keyof T["Select"]]?: unknown };
      Delete?: boolean;
   },
   Extra extends Record<string, unknown> = Record<string, unknown>,
>(options: SqlTableOptions<T>, extra?: Extra): SqlTableExtended<T> & Extra {
   const table = new SqlTable(options);
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const result = newSqlTableProxy(table as any, extra) as SqlTableExtended<T> & Extra;
   SqlTable.register(result as unknown as SqlTableAny);
   return result;
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
