import { ObjectLiteral, Repository } from "typeorm";
import { newSqlTable, SqlTableExtended } from "@vexnor/core";
import { getDialect } from "#/dialect.js";

type FromTypeORMResult<T> = SqlTableExtended<{
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   Select: T extends Record<string, any> ? T : Record<string, any>;
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   Insert: Partial<T extends Record<string, any> ? T : Record<string, any>>;
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   Update: Partial<T extends Record<string, any> ? T : Record<string, any>>;
   Delete: true;
}>;

/**
 * Converts a TypeORM entity into a vexnor runtime table.
 *
 * Pass a typed Repository — the entity type, table name, schema, and dialect
 * are all inferred automatically from it.
 *
 * Works with both decorator-based entities and EntitySchema definitions.
 *
 * @example
 * // Decorator entity
 * const Account = fromTypeORM(dataSource.getRepository(AccountEntity));
 *
 * // EntitySchema
 * const Account = fromTypeORM(dataSource.getRepository(AccountSchema));
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromTypeORM<T>(repository: Repository<T extends ObjectLiteral ? T : any>): FromTypeORMResult<T> {
   const columns: Record<string, string> = {};
   const pk: string[] = [];

   for (const col of repository.metadata.columns) {
      if (col.isVirtual) continue;
      columns[col.propertyName] = col.databaseName;
      if (col.isPrimary) pk.push(col.propertyName);
   }

   const { schema, tableName, tableType } = repository.metadata;
   const isView = tableType === "view";
   return newSqlTable({
      tableInfo: { name: tableName, schema: schema ?? null },
      pk,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      columns: columns as any,
      dialect: getDialect(repository.metadata.connection.options.type),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      crud: { select: true, insert: !isView, update: !isView, delete: !isView } as any,
   }) as FromTypeORMResult<T>;
}
