import type { SqlTableAny, SqlTableForeignKey } from "#src/core/schema/sql-table.js";

/**
 * Schema manifest format for cross-runtime FK-based join path resolution.
 *
 * This is the output of `vexnor serialize --schema` — a JSON file that another
 * stack (.NET, Go, Java) can consume to build a SchemaGraph and resolve FK-based
 * BFS join paths without needing the TypeScript runtime.
 */
export interface SchemaManifest {
   /** Manifest schema version. */
   version: 1;
   /** SQL dialect (e.g., "postgresql", "transactsql", "sqlite"). */
   dialect: string;
   /** Map of "schema.tableName" → table definition. */
   tables: Record<string, SchemaManifestTable>;
}

/** Column metadata in the schema manifest. */
export interface SchemaManifestColumn {
   /** camelCase column key (the TypeScript property name). */
   name: string;
   /** Database column type (e.g., "integer", "varchar", "timestamptz"). */
   type: string;
   /** True if the column is nullable. Omitted when false. */
   nullable?: true;
}

/** Foreign key metadata in the schema manifest. */
export interface SchemaManifestForeignKey {
   /** Source column (camelCase key on this table). */
   column: string;
   /** Target table as "schema.tableName". */
   targetTable: string;
   /** Target column (camelCase key on the target table). */
   targetColumn: string;
   /** Complete source columns for a composite relationship. */
   columns?: string[];
   /** Complete target columns for a composite relationship. */
   targetColumns?: string[];
}

/** Table definition in the schema manifest. */
export interface SchemaManifestTable {
   /** Column definitions in table-declaration order. */
   columns: SchemaManifestColumn[];
   /** Primary key column keys. */
   pk: string[];
   /** Foreign key references. */
   fk: SchemaManifestForeignKey[];
   /** Catalog object kind when the source mapping provides it. */
   kind?: "table" | "view";
}

export interface SerializeSchemaOptions {
   /**
    * `stable-identity` keeps the historical PK and partition filtering.
    * `all-readable` includes every SqlTable supplied to the serializer.
    */
   include?: "stable-identity" | "all-readable";
}

/**
 * Serializes a schema object (Record of SqlTable instances) into a portable
 * schema manifest for cross-runtime BFS join path resolution.
 *
 * Tables without PKs and partition tables (names containing "_p20" or "_p0000")
 * are excluded — matching SchemaGraph's filtering logic.
 *
 * @param schema - A record of SqlTable instances (same format SchemaGraph accepts).
 * @param dialect - The SQL dialect (e.g., "postgresql", "transactsql", "sqlite").
 * @param options - Controls whether only stable-identity tables or every readable mapping is included.
 */
export function serializeSchema(
   schema: Record<string, unknown>,
   dialect: string,
   options: SerializeSchemaOptions = {},
): SchemaManifest {
   const tables: Record<string, SchemaManifestTable> = {};
   const include = options.include ?? "stable-identity";

   for (const entity of Object.values(schema)) {
      if (!isTable(entity)) continue;
      const t = entity;

      // Skip tables without PKs (views)
      if (include === "stable-identity" && (!t.pk || (t.pk as unknown[]).length === 0)) continue;

      // Skip partition tables
      const name = t.tableInfo.name;
      if (include === "stable-identity" && (name.includes("_p20") || name.includes("_p0000"))) continue;

      const tableSchema = t.tableInfo.schema ?? "public";
      const key = `${tableSchema}.${name}`;

      const columns: SchemaManifestColumn[] = t.colKeys.map((colKey: string) => {
         const db = t.dbSchema?.[colKey as keyof typeof t.dbSchema] as
            | { dbType?: string; nullable?: boolean }
            | undefined;
         return {
            name: colKey,
            type: db?.dbType ?? "unknown",
            ...(db?.nullable ? { nullable: true as const } : {}),
         };
      });

      const fk: SchemaManifestForeignKey[] = (t.fk as SqlTableForeignKey[]).map((f) => ({
         column: f.from[0]!,
         targetTable: `${f.to.schema || tableSchema}.${f.to.table}`,
         targetColumn: f.to.columns[0]!,
         ...(f.from.length > 1 ? { columns: [...f.from], targetColumns: [...f.to.columns] } : {}),
      }));

      tables[key] = {
         columns,
         pk: t.pk as string[],
         fk,
         ...(isCatalogTable(t) ? { kind: t.objectKind } : {}),
      };
   }

   // Sort tables by key for deterministic output
   const sorted: Record<string, SchemaManifestTable> = {};
   for (const k of Object.keys(tables).sort()) {
      sorted[k] = tables[k]!;
   }

   return {
      version: 1,
      dialect,
      tables: sorted,
   };
}

function isTable(entity: unknown): entity is SqlTableAny {
   return (
      !!entity &&
      typeof entity === "object" &&
      "tableInfo" in entity &&
      "colKeys" in entity &&
      "pk" in entity
   );
}

function isCatalogTable(table: SqlTableAny): table is SqlTableAny & { catalogId: string; objectKind: "table" | "view" } {
   return "catalogId" in table && typeof table.catalogId === "string" &&
      "objectKind" in table && (table.objectKind === "table" || table.objectKind === "view");
}
