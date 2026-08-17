import {
   newSqlTable,
   type SqlTableDbColumnSchema,
   type SqlTableExtended,
   type SqlTableForeignKey,
} from "#src/core/schema/sql-table.js";
import type { SqlColumnStructure } from "#src/core/schema/sql-table-column.js";
import type { SqlJsonType } from "#src/core/utils/sql-json-schema.js";
import { SqlLiteralType } from "#src/plugin/sql-literal.js";
import type {
   SchemaCatalog,
   SchemaCatalogColumnTypeTree,
   SchemaCatalogEnum,
   SchemaCatalogObject,
} from "#src/schema/schema-catalog.js";
import { reconcileSchemaSelection, type SchemaSelectionScope } from "#src/schema/schema-selection.js";

type RuntimeReadTableArgs = {
   Select: Record<string, unknown>;
   Source: string;
};

type RuntimeMutableTableArgs = RuntimeReadTableArgs & {
   Insert: Record<string, unknown>;
   Update: Record<string, unknown>;
   Delete: true;
};

type RuntimeTable = SqlTableExtended<RuntimeReadTableArgs> | SqlTableExtended<RuntimeMutableTableArgs>;

export type RuntimeSqlTable = RuntimeTable & {
   readonly catalogId: string;
   readonly objectKind: SchemaCatalogObject["kind"];
};

type RuntimeTableMetadata = Pick<RuntimeSqlTable, "catalogId" | "objectKind">;

export type RuntimeSchemaMapping = {
   id: string;
   schema: string;
   name: string;
   mappingName: string;
   kind: SchemaCatalogObject["kind"];
   table: RuntimeSqlTable;
};

export type RuntimeSchemaMappings = {
   source: string;
   mappings: RuntimeSchemaMapping[];
   schema: Record<string, RuntimeSqlTable>;
};

export function createRuntimeSchemaMappings({
   catalog,
   selection,
   source = `vexnor-local:${catalog.fingerprint}`,
}: {
   catalog: SchemaCatalog;
   selection: SchemaSelectionScope;
   source?: string;
}): RuntimeSchemaMappings {
   const resolved = reconcileSchemaSelection({ catalog, selection });
   const selectedIds = new Set(resolved.selectedObjects.map((object) => object.id));
   const catalogById = new Map(catalog.objects.map((object) => [object.id, object]));
   const mappings = catalog.objects
      .filter((object) => selectedIds.has(object.id))
      .map(
         (object): RuntimeSchemaMapping => ({
            id: object.id,
            schema: object.schema,
            name: object.name,
            mappingName: object.mappingName,
            kind: object.kind,
            table: createRuntimeTable({
               object,
               catalogById,
               selectedIds,
               source,
               dialect: catalog.plugin.dialect,
               enums: catalog.enums,
            }),
         }),
      );

   return {
      source,
      mappings,
      schema: Object.fromEntries(mappings.map((mapping) => [mapping.id, mapping.table])),
   };
}

function createRuntimeTable({
   object,
   catalogById,
   selectedIds,
   source,
   dialect,
   enums,
}: {
   object: SchemaCatalogObject;
   catalogById: Map<string, SchemaCatalogObject>;
   selectedIds: Set<string>;
   source: string;
   dialect: string;
   enums: SchemaCatalogEnum[];
}): RuntimeSqlTable {
   const columns: Record<string, string> = {};
   const dbSchema: Record<string, SqlTableDbColumnSchema> = {};
   const jsonSchema: Record<string, SqlJsonType> = {};
   for (const column of object.columns) {
      const udt = column.customType?.udt;
      const enumValues =
         column.normalizedType === SqlLiteralType.Udt && udt
            ? enums.find((entry) => entry.id === `${object.schema}.${udt}`)?.values
            : undefined;
      columns[column.mappingName] = column.physicalName;
      dbSchema[column.mappingName] = {
         dbType: column.nativeType,
         type: column.normalizedType,
         ...(column.nullable ? { nullable: true } : {}),
         ...(column.default !== null ? { default: column.default } : {}),
         ...(enumValues ? { values: enumValues } : {}),
         ...(column.typeTree ? runtimeColumnStructure(column.typeTree) : {}),
      };
      if (column.normalizedType === SqlLiteralType.Date) jsonSchema[column.mappingName] = "Date";
   }

   const foreignKeys: SqlTableForeignKey[] = object.relationships
      .filter((relationship) => selectedIds.has(relationship.toObject))
      .map((relationship) => {
         const target = catalogById.get(relationship.toObject);
         if (!target) throw new Error(`Relationship target is missing from schema catalog: ${relationship.toObject}`);
         return {
            from: relationship.columnPairs.map((pair) => mappingName(object, pair.from)),
            to: {
               schema: target.schema,
               table: target.name,
               columns: relationship.columnPairs.map((pair) => mappingName(target, pair.to)),
            },
         };
      });
   const extra: RuntimeTableMetadata = { catalogId: object.id, objectKind: object.kind };
   const shared = {
      tableInfo: { name: object.name, schema: object.schema },
      columns,
      pk: object.primaryKey?.columns.map((column) => mappingName(object, column)) ?? [],
      fk: foreignKeys,
      dialect,
      source,
      dbSchema,
      jsonSchema,
   };

   if (object.kind === "view") {
      return newSqlTable<RuntimeReadTableArgs, RuntimeTableMetadata>(
         { ...shared, crud: { select: true, insert: false, update: false, delete: false } },
         extra,
      );
   }
   return newSqlTable<RuntimeMutableTableArgs, RuntimeTableMetadata>(
      { ...shared, crud: { select: true, insert: true, update: true, delete: true } },
      extra,
   );
}

function mappingName(object: SchemaCatalogObject, physicalColumn: string): string {
   const column = object.columns.find((candidate) => candidate.physicalName === physicalColumn);
   if (!column) throw new Error(`Column is missing from schema catalog object ${object.id}: ${physicalColumn}`);
   return column.mappingName;
}

function runtimeColumnStructure(
   typeTree: SchemaCatalogColumnTypeTree,
): { structure: SqlColumnStructure } | Record<never, never> {
   switch (typeTree.kind) {
      case "struct":
         return {
            structure: {
               kind: "struct",
               fields: Object.fromEntries(
                  typeTree.fields.map((field) => [
                     field.mappingName,
                     {
                        fieldName: field.physicalName,
                        ...runtimeColumnStructure(field.value),
                     },
                  ]),
               ),
            },
         };
      case "list": {
         const value = runtimeColumnStructure(typeTree.value);
         return {
            structure: {
               kind: "list",
               value: "structure" in value ? value.structure : null,
            },
         };
      }
      case "scalar":
      case "map":
      case "union":
         return {};
   }
}
