import { CodeWriter } from "#src/lib/code-writer.js";
import { SqlForeignKeyInfo, SqlLiteralType } from "#src/plugin/plugin.js";
import { getCodegenContext } from "#src/cli/codegen/codegen-context.js";
import type { SchemaCatalogObject } from "#src/schema/schema-catalog.js";

export function writeTableType(writer: CodeWriter, { table }: { table: SchemaCatalogObject }) {
   const { getColumnName, dialect } = getCodegenContext();
   const { name, columns, schema, primaryKey, kind, relationships, mappingName } = table;
   const isView = kind === "view";
   const tableTypeName = mappingName;
   const tableTypePrefix = `I${tableTypeName}`;
   const tableTypeSelect = `${tableTypePrefix}Select`;
   const tableTypeInsert = `${tableTypePrefix}Insert`;
   const tableTypeUpdate = `${tableTypePrefix}Update`;

   writer
      .write(`export const ${tableTypeName} = vexnor.newSqlTable`)
      .genericBlock(() => {
         writer.writeLine(`Select: ${tableTypeSelect};`);
         if (!isView) {
            writer.writeLine(`Insert: ${tableTypeInsert};`);
            writer.writeLine(`Update: ${tableTypeUpdate};`);
            writer.writeLine(`Delete: true;`);
         }
         writer.writeLine(`Source: "${getCodegenContext().source}";`);
      })
      .write(`(`)
      .inlineBlock(() => {
         writer
            .write(`crud:`)
            .inlineBlock(() => {
               writer.writeLine(`select: true,`);
               writer.writeLine(`insert: ${!isView},`);
               writer.writeLine(`update: ${!isView},`);
               writer.writeLine(`delete: ${!isView},`);
            })
            .writeLine(",");
         writer
            .write("tableInfo:")
            .inlineBlock(() => {
               writer.writeLine(`name: "${name}",`);
               writer.writeLine(`schema: "${schema}",`);
            })
            .writeLine(",");
         writer.writeLine(
            `pk: [${primaryKey ? `"${primaryKey.columns.map(getColumnName).join('","')}"` : ""}],`,
         );
         writer.writeLine(`dialect: "${dialect}",`);
         writer.writeLine(`source: "${getCodegenContext().source}",`);
         writer
            .write(`columns:`)
            .inlineBlock(() => {
               columns.forEach((col) => {
                  const colAlias = col.mappingName;
                  writer.blankLine();
                  writer
                     .writeLine(`/**`)
                     .write(` * ${col.physicalName} ${col.nativeType}`)
                     .write(col.default ? ` default ${col.default}` : "")
                     .newLine()
                     .writeLine(` */`)
                     .writeLine(`${colAlias}: "${col.physicalName}",`);
               });
            })
            .writeLine(",");
         const dateColumns = columns.filter((column) => column.normalizedType === SqlLiteralType.Date);
         if (dateColumns.length) {
            writer
               .write(`jsonSchema:`)
               .inlineBlock(() => {
                  dateColumns.forEach((column) => {
                     writer.writeLine(`${column.mappingName}: "Date",`);
                  });
               })
               .writeLine(",");
         }
         // Emit foreign keys (tables only, not views)
         const fks = relationships.map((relationship) => ({
            from: relationship.columnPairs.map((pair) => getColumnName(pair.from)),
            toSchema: relationship.toObject.slice(0, relationship.toObject.indexOf(".")),
            toTable: relationship.toObject.slice(relationship.toObject.indexOf(".") + 1),
            toColumns: relationship.columnPairs.map((pair) => getColumnName(pair.to)),
         }));
         if (!isView && fks.length) {
            writer.writeLine(`fk: [`);
            fks.forEach((fk) => {
               writer.writeLine(
                  `   { from: [${fk.from.map((c) => `"${c}"`).join(", ")}], to: { schema: "${fk.toSchema}", table: "${fk.toTable}", columns: [${fk.toColumns.map((c) => `"${c}"`).join(", ")}] } },`,
               );
            });
            writer.writeLine(`],`);
         }
         // Emit dbSchema
         const { enums } = getCodegenContext();
         writer
            .write(`dbSchema:`)
               .inlineBlock(() => {
                  columns.forEach((col) => {
                     const colAlias = col.mappingName;
                     const parts: string[] = [
                        `dbType: "${col.nativeType}"`,
                        `type: vexnor.SqlLiteralType.${Object.entries(SqlLiteralType).find(([, value]) => value === col.normalizedType)?.[0] ?? "Unknown"}`,
                     ];
                     if (col.nullable) parts.push(`nullable: true`);
                     if (col.default != null) parts.push(`default: ${JSON.stringify(col.default)}`);
                     if (col.normalizedType === SqlLiteralType.Udt && col.customType?.udt) {
                        const enumInfo = enums.find((entry) => entry.id === `${schema}.${col.customType?.udt}`);
                        if (enumInfo) {
                           parts.push(`values: [${enumInfo.values.map((value) => `"${value}"`).join(", ")}]`);
                        }
                     }
                     writer.writeLine(`${colAlias}: { ${parts.join(", ")} },`);
                  });
               })
               .writeLine(",");
      })
      .write(");");
}

export function groupForeignKeys(
   foreignKeys: SqlForeignKeyInfo[],
   getColumnName: (name: string) => string,
): { from: string[]; toSchema: string; toTable: string; toColumns: string[] }[] {
   const grouped = new Map<string, { from: string[]; toSchema: string; toTable: string; toColumns: string[] }>();
   for (const fk of foreignKeys) {
      const key = fk.constraint_name;
      const existing = grouped.get(key);
      if (existing) {
         existing.from.push(getColumnName(fk.column_name));
         existing.toColumns.push(getColumnName(fk.referenced_column_name));
      } else {
         grouped.set(key, {
            from: [getColumnName(fk.column_name)],
            toSchema: fk.referenced_table_schema,
            toTable: fk.referenced_table_name,
            toColumns: [getColumnName(fk.referenced_column_name)],
         });
      }
   }
   // Sort deterministically by from columns to prevent codegen churn
   // when the DB returns constraint metadata in non-deterministic order
   return [...grouped.values()].sort((a, b) => a.from.join(",").localeCompare(b.from.join(",")));
}
