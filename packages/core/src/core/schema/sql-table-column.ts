import { SqlColumnFormat } from "#src/core/builder/default-formatter.js";
import { Sql, TYPE } from "#src/core/sql-base.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#src/core/builder/sql-build-options.js";
import { SqlTableIdentity } from "#src/core/schema/sql-table-identity.js";
import { SqlJsonSchema, SqlJsonType } from "#src/core/utils/sql-json-schema.js";

export type SqlTableColumnTypeArgs = {
   Key: string;
   Type: unknown;
};

export type SqlColumnStructure =
   | { kind: "struct"; fields: Record<string, SqlColumnStructureField> }
   | { kind: "list"; value: SqlColumnStructure | null };

export type SqlColumnStructureField = {
   fieldName: string;
   structure?: SqlColumnStructure;
};

type StructuredObject<Value> = NonNullable<Value> extends readonly unknown[]
   ? never
   : NonNullable<Value> extends Record<string, unknown>
     ? NonNullable<Value>
     : never;

type NestedValue<Parent, Key extends keyof StructuredObject<Parent>> =
   | StructuredObject<Parent>[Key]
   | Extract<Parent, null | undefined>;

export type SqlNestedColumnProperties<Value> = [StructuredObject<Value>] extends [never]
   ? Record<never, never>
   : {
        [Key in Extract<keyof StructuredObject<Value>, string> as `$${Key}`]: SqlTableColumnReference<{
           Key: Key;
           Type: NestedValue<Value, Key>;
        }>;
     };

export type SqlTableColumnReference<T extends SqlTableColumnTypeArgs> =
   SqlTableColumn<T> & SqlNestedColumnProperties<T["Type"]>;

export type SqlTableColumnOptions<T extends SqlTableColumnTypeArgs> = Pick<
   SqlTableColumn<T>,
   "columnName" | "key" | "tableInfo"
> &
   Partial<Pick<SqlTableColumn<T>, "format" | "jsonType">> & {
      path?: readonly string[];
      structure?: SqlColumnStructure | null;
   };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableColumnAny = SqlTableColumn<any>;

export class SqlTableColumn<T extends SqlTableColumnTypeArgs> extends Sql {
   declare readonly [TYPE]: Record<T["Key"], T["Type"]>;

   readonly key: T["Key"];
   readonly columnName: string;
   readonly tableInfo: SqlTableIdentity;
   readonly format: SqlColumnFormat | null;
   readonly jsonType: SqlJsonType | null;
   readonly #path: readonly string[];
   readonly #structure: SqlColumnStructure | null;
   readonly #nestedColumns = new Map<string, SqlTableColumnAny>();

   constructor({ columnName, key, tableInfo, format, jsonType, path = [], structure = null }: SqlTableColumnOptions<T>) {
      super({
         type: "SqlTableColumn",
         ...(() => {
            const table = tableInfo.alias || tableInfo.name;
            const fieldName = path.at(-1) ?? columnName;
            let hashId = `${table}.${[columnName, ...path].join(".")}`;
            if (key !== fieldName) hashId += ` as ${key}`;

            return {
               id: hashId,
               hashId,
            };
         })(),
      });
      this.columnName = columnName;
      this.key = key;
      this.tableInfo = tableInfo;
      this.format = format ?? null;
      this.jsonType = jsonType ?? null;
      this.#path = path;
      this.#structure = structure;
   }

   get path(): readonly string[] {
      return this.#path;
   }

   get structure(): SqlColumnStructure | null {
      return this.#structure;
   }

   getNestedColumn(key: string): SqlTableColumnAny | undefined {
      if (this.#structure?.kind !== "struct") return undefined;
      const field = this.#structure.fields[key];
      if (!field) return undefined;

      let result = this.#nestedColumns.get(key);
      if (!result) {
         result = newSqlTableColumn({
            columnName: this.columnName,
            key,
            tableInfo: this.tableInfo,
            path: [...this.#path, field.fieldName],
            structure: field.structure ?? null,
         });
         this.#nestedColumns.set(key, result);
      }
      return result;
   }

   get jsonSchema(): SqlJsonSchema {
      if (!this.jsonType) {
         return {};
      }

      return { [this.key]: this.jsonType };
   }

   /**
    * Returns a copy of this column reference with a different result key.
    *
    * Use this to rename a column in the SELECT output without changing the
    * underlying column name.
    *
    * @param key - The new result key and TypeScript property name.
    *
    * @example
    * sql`SELECT ${row(Account.$firstName.as("name"))} FROM ${Account}`
    * // result: { name: string }
    */
   as<Key extends string>(key: Key): SqlTableColumnReference<{ Key: Key; Type: T["Type"] }> {
      return newSqlTableColumn({
         columnName: this.columnName,
         key,
         tableInfo: this.tableInfo,
         format: this.format,
         jsonType: this.jsonType,
         path: this.#path,
         structure: this.#structure,
      });
   }

   /**
    * Shortcut: renders as `"alias"."col"` without AS alias.
    * Use when the column is inside an expression, cast, or function.
    */
   get raw(): SqlTableColumnReference<T> {
      return this.render("tableAlias.columnName");
   }

   /**
    * Returns a copy of this column with a specific output format.
    *
    * Use this to control how the column is rendered in SQL — e.g., without
    * an alias inside aggregate function calls.
    *
    * @param format - The column format to use when building SQL.
    */
   render(format: SqlColumnFormat): SqlTableColumnReference<T> {
      return newSqlTableColumn({
         columnName: this.columnName,
         key: this.key,
         tableInfo: this.tableInfo,
         format,
         jsonType: this.jsonType,
         path: this.#path,
         structure: this.#structure,
      });
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   write(context: SqlBuildContext, _options?: SqlBuildOptions) {
      const format = this.format ?? context.formatter.getColumnFormat(context);
      const columnName = [this.columnName, ...this.#path].join(".");
      const fieldName = this.#path.at(-1) ?? this.columnName;
      switch (format) {
         case "tableName.columnName AS columnAlias": {
            if (this.key === fieldName || !this.key) {
               context.addQuotes(`${this.tableInfo.name}.${columnName}`);
               break;
            }
            context.addQuotes(`${this.tableInfo.name}.${columnName} as ${this.key}`);
            break;
         }
         case "tableName.columnName":
            context.addQuotes(`${this.tableInfo.name}.${columnName}`);
            break;
         case "columnName":
            context.addQuotes(`${columnName}`);
            break;
         case "tableName.columnAlias":
            context.addQuotes(`${this.tableInfo.name}.${this.key ?? this.columnName}`);
            break;
         case "columnAlias":
            context.addQuotes(`${this.key ?? this.columnName}`);
            break;
         case "tableAlias.columnName":
            context.addQuotes(`${context.getAlias(this.tableInfo)}.${columnName}`);
            break;
         case "tableAlias.columnName AS columnAlias": {
            if (this.key === fieldName || !this.key) {
               context.addQuotes(`${context.getAlias(this.tableInfo)}.${columnName}`);
               break;
            }

            context.addQuotes(`${context.getAlias(this.tableInfo)}.${columnName} as ${this.key}`);
            break;
         }
         case "rawAlias.columnName":
            context.addStrings(`${this.tableInfo.alias}.${columnName}`);
            break;
      }
   }
}

export function newSqlTableColumn<
   T extends {
      Key: string;
      Type: unknown;
   },
>(options: SqlTableColumnOptions<T>): SqlTableColumnReference<T> {
   const column = new SqlTableColumn(options);
   return new Proxy(column, {
      get(target, property) {
         if (Reflect.has(target, property)) {
            const result: unknown = Reflect.get(target, property, target);
            return property !== "constructor" && typeof result === "function" ? result.bind(target) : result;
         }
         if (typeof property !== "string" || !property.startsWith("$")) return undefined;
         return target.getNestedColumn(property.slice(1));
      },
   }) as SqlTableColumnReference<T>;
}
