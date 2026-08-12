import { createHash } from "node:crypto";
import to from "to-case";
import type { SqlColumnInfo, SqlColumnType, SqlForeignKeyInfo, SqlSchema } from "#src/plugin/plugin.js";
import { SqlLiteralType } from "#src/plugin/sql-literal.js";

export const SCHEMA_CATALOG_FORMAT_VERSION = 1 as const;

export interface SchemaCatalog {
   formatVersion: typeof SCHEMA_CATALOG_FORMAT_VERSION;
   fingerprint: string;
   plugin: SchemaCatalogPlugin;
   schemas: string[];
   enums: SchemaCatalogEnum[];
   objects: SchemaCatalogObject[];
   warnings: SchemaCatalogWarning[];
}

export interface SchemaCatalogPlugin {
   name: string;
   version: string;
   driver: string;
   dialect: string;
}

export interface SchemaCatalogEnum {
   id: string;
   schema: string;
   name: string;
   values: string[];
}

export interface SchemaCatalogObject {
   id: string;
   schema: string;
   name: string;
   kind: "table" | "view";
   mappingName: string;
   columns: SchemaCatalogColumn[];
   primaryKey: SchemaCatalogPrimaryKey | null;
   relationships: SchemaCatalogRelationship[];
   capabilities: SchemaCatalogObjectCapabilities;
   warnings: SchemaCatalogWarning[];
}

export interface SchemaCatalogColumn {
   id: string;
   physicalName: string;
   mappingName: string;
   nativeType: string;
   dataType: string | null;
   normalizedType: SqlLiteralType;
   ordinalPosition: number;
   nullable: boolean;
   default: string | null;
   generated: boolean;
   generationExpression: string | null;
   identity: boolean;
   identityGeneration: string | null;
   updatable: boolean;
   domainName: string | null;
   array: boolean;
   customType: SchemaCatalogCustomType | null;
   warnings: SchemaCatalogWarning[];
}

export interface SchemaCatalogCustomType {
   udt: string | null;
   select: string | null;
   insert: string | null;
   import: string | null;
}

export interface SchemaCatalogPrimaryKey {
   constraintName: string;
   columns: string[];
}

export interface SchemaCatalogRelationship {
   constraintName: string;
   fromObject: string;
   toObject: string;
   columnPairs: SchemaCatalogRelationshipColumnPair[];
}

export interface SchemaCatalogRelationshipColumnPair {
   from: string;
   to: string;
}

export interface SchemaCatalogObjectCapabilities {
   readable: true;
   insertable: boolean;
   updatable: boolean;
   deletable: boolean;
   stableIdentity: boolean;
   automaticJoin: boolean;
}

export interface SchemaCatalogWarning {
   code: "unknown-column-type" | "missing-plugin-version";
   message: string;
}

export interface CreateSchemaCatalogOptions {
   plugin: SchemaCatalogPluginSource;
   schema: SqlSchema;
   naming?: {
      camelCaseColumns?: boolean;
   };
}

export interface SchemaCatalogPluginSource {
   readonly name: string;
   readonly version: string;
   readonly driver: string;
   readonly dialect: string;
   getColumnType(column: SqlColumnInfo): SqlColumnType;
}

export function createSchemaCatalog({ plugin, schema, naming }: CreateSchemaCatalogOptions): SchemaCatalog {
   assertUniqueObjectIds(schema);

   const enums = schema.enums
      .map((entry) => ({
         id: qualify(entry.enum_schema, entry.enum_name),
         schema: entry.enum_schema,
         name: entry.enum_name,
         values: entry.enum_values
            .map((value, index) => ({ label: value.enum_label, ordinal: value.ordinal_position ?? index }))
            .sort(compareOrdinalThen((value) => value.label))
            .map((value) => value.label),
      }))
      .sort(compareBy((entry) => entry.id));

   const catalogObjects = schema.tables
      .map((table): SchemaCatalogObject => {
         assertUniqueColumnIds(table.table_schema, table.table_name, table.columns.map((column) => column.column_name));

         const objectId = qualify(table.table_schema, table.table_name);
         const columns = table.columns
            .map((column, index): SchemaCatalogColumn => {
               const columnType = plugin.getColumnType(column);
               const warnings = columnWarnings(objectId, column.column_name, columnType);
               return {
                  id: `${objectId}.${column.column_name}`,
                  physicalName: column.column_name,
                  mappingName: naming?.camelCaseColumns ? to.camel(column.column_name) : column.column_name,
                  nativeType: column.udt_name ?? column.data_type ?? "unknown",
                  dataType: column.data_type ?? null,
                  normalizedType: columnType.type,
                  ordinalPosition: column.ordinal_position ?? index + 1,
                  nullable: column.is_nullable === "YES",
                  default: column.column_default,
                  generated: column.is_generated !== undefined && column.is_generated !== "NEVER" && column.is_generated !== "NO",
                  generationExpression: column.generation_expression ?? null,
                  identity: column.is_identity === "YES",
                  identityGeneration: column.identity_generation ?? null,
                  updatable: column.is_updatable === "YES",
                  domainName: column.domain_name ?? null,
                  array: columnType.isArray ?? false,
                  customType: customType(columnType),
                  warnings,
               };
            })
            .sort((left, right) => left.ordinalPosition - right.ordinalPosition || left.physicalName.localeCompare(right.physicalName));

         const primaryKey = createPrimaryKey(table.primary_keys);
         const relationships = createRelationships(objectId, table.foreign_keys ?? []);
         const warnings = columns.flatMap((column) => column.warnings);
         const mutable = table.table_type === "table";

         return {
            id: objectId,
            schema: table.table_schema,
            name: table.table_name,
            kind: table.table_type,
            mappingName: to.pascal(table.table_name),
            columns,
            primaryKey,
            relationships,
            capabilities: {
               readable: true,
               insertable: mutable,
               updatable: mutable,
               deletable: mutable,
               stableIdentity: primaryKey !== null,
               automaticJoin: relationships.length > 0,
            },
            warnings,
         };
      })
      .sort(compareBy((object) => object.id));

   const joinableObjects = new Set(
      catalogObjects.flatMap((object) => object.relationships.flatMap((relationship) => [relationship.fromObject, relationship.toObject])),
   );
   const objects = catalogObjects.map((object) => ({
      ...object,
      capabilities: {
         ...object.capabilities,
         automaticJoin: joinableObjects.has(object.id),
      },
   }));

   const pluginWarnings: SchemaCatalogWarning[] = plugin.version === "unknown"
      ? [{ code: "missing-plugin-version", message: `Plugin ${plugin.name} did not declare a version.` }]
      : [];
   const withoutFingerprint = {
      formatVersion: SCHEMA_CATALOG_FORMAT_VERSION,
      plugin: {
         name: plugin.name,
         version: plugin.version,
         driver: plugin.driver,
         dialect: plugin.dialect,
      },
      schemas: [...new Set([...objects.map((object) => object.schema), ...enums.map((entry) => entry.schema)])].sort(),
      enums,
      objects,
      warnings: pluginWarnings,
   };
   const fingerprint = createHash("sha256").update(JSON.stringify(withoutFingerprint)).digest("hex");

   return {
      formatVersion: withoutFingerprint.formatVersion,
      fingerprint,
      plugin: withoutFingerprint.plugin,
      schemas: withoutFingerprint.schemas,
      enums: withoutFingerprint.enums,
      objects: withoutFingerprint.objects,
      warnings: withoutFingerprint.warnings,
   };
}

function customType(type: SqlColumnType): SchemaCatalogCustomType | null {
   if (!type.udt && !type.tsTypeSelect && !type.tsTypeInsert && !type.tsImport) return null;
   return {
      udt: type.udt ?? null,
      select: type.tsTypeSelect ?? null,
      insert: type.tsTypeInsert ?? null,
      import: type.tsImport ?? null,
   };
}

function columnWarnings(objectId: string, columnName: string, type: SqlColumnType): SchemaCatalogWarning[] {
   if (type.type !== SqlLiteralType.Unknown) return [];
   return [{
      code: "unknown-column-type",
      message: `Column ${objectId}.${columnName} uses an unsupported or unknown native type.`,
   }];
}

function createPrimaryKey(primaryKeys: SqlSchema["tables"][number]["primary_keys"]): SchemaCatalogPrimaryKey | null {
   if (primaryKeys.length === 0) return null;
   const constraintNames = [...new Set(primaryKeys.map((primaryKey) => primaryKey.constraint_name))];
   if (constraintNames.length !== 1) {
      throw new Error(`Expected one primary-key constraint, received: ${constraintNames.sort().join(", ")}`);
   }
   return {
      constraintName: constraintNames[0]!,
      columns: primaryKeys
         .map((primaryKey, index) => ({ name: primaryKey.column_name, ordinal: primaryKey.ordinal_position ?? index }))
         .sort(compareOrdinalThen((entry) => entry.name))
         .map((entry) => entry.name),
   };
}

function createRelationships(fromObject: string, foreignKeys: SqlForeignKeyInfo[]): SchemaCatalogRelationship[] {
   const groups = new Map<string, { constraintName: string; toObject: string; pairs: { from: string; to: string; ordinal: number }[] }>();
   foreignKeys.forEach((foreignKey, index) => {
      const toObject = qualify(foreignKey.referenced_table_schema, foreignKey.referenced_table_name);
      const groupId = `${foreignKey.constraint_name}\u0000${toObject}`;
      const group = groups.get(groupId) ?? {
         constraintName: foreignKey.constraint_name,
         toObject,
         pairs: [],
      };
      group.pairs.push({
         from: foreignKey.column_name,
         to: foreignKey.referenced_column_name,
         ordinal: foreignKey.ordinal_position ?? index,
      });
      groups.set(groupId, group);
   });

   return [...groups.values()]
      .map((group) => ({
         constraintName: group.constraintName,
         fromObject,
         toObject: group.toObject,
         columnPairs: group.pairs
            .sort(compareOrdinalThen((pair) => `${pair.from}\u0000${pair.to}`))
            .map(({ from, to }) => ({ from, to })),
      }))
      .sort(compareBy((relationship) => `${relationship.constraintName}\u0000${relationship.toObject}`));
}

function assertUniqueObjectIds(schema: SqlSchema): void {
   assertUnique("schema object", schema.tables.map((table) => qualify(table.table_schema, table.table_name)));
   assertUnique("schema enum", schema.enums.map((entry) => qualify(entry.enum_schema, entry.enum_name)));
}

function assertUniqueColumnIds(schema: string, table: string, columns: string[]): void {
   assertUnique(`column in ${qualify(schema, table)}`, columns);
}

function assertUnique(kind: string, values: string[]): void {
   const seen = new Set<string>();
   for (const value of values) {
      if (seen.has(value)) throw new Error(`Duplicate ${kind} identity: ${value}`);
      seen.add(value);
   }
}

function qualify(schema: string, name: string): string {
   return `${schema}.${name}`;
}

function compareBy<T>(getValue: (value: T) => string): (left: T, right: T) => number {
   return (left, right) => getValue(left).localeCompare(getValue(right));
}

function compareOrdinalThen<T extends { ordinal: number }>(getValue: (value: T) => string): (left: T, right: T) => number {
   return (left, right) => left.ordinal - right.ordinal || getValue(left).localeCompare(getValue(right));
}
