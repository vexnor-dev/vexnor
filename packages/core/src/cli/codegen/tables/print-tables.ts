import fs from "node:fs/promises";
import path from "node:path";
import to from "to-case";
import { writeTable } from "#src/cli/codegen/tables/write-table.js";
import { SqlOutputFile } from "#src/plugin/plugin.js";
import { getCodegenContext } from "#src/cli/codegen/codegen-context.js";
import { logger } from "#src/logger.js";
import type { SchemaCatalogObject } from "#src/schema/schema-catalog.js";

export interface WriteTablesArgs {
   tables: SchemaCatalogObject[];
}

export async function printTables({ tables }: WriteTablesArgs): Promise<SqlOutputFile[]> {
   const files: SqlOutputFile[] = [];
   const { outDir } = getCodegenContext();
   for (const table of tables) {
      const { name, schema, mappingName } = table;
      const output = writeTable({ table });
      const fileName = `${to.snake(schema)}.${to.snake(name)}-${table.kind === "view" ? "view" : "table"}`;
      const filePath = path.join(outDir, `${fileName}.ts`);
      files.push({
         moduleName: name,
         fileName,
         schemaName: schema,
         tableTypeName: mappingName,
      });
      logger.debug({ tableSchema: schema, tableName: name, filePath }, "Writing table file");
      await fs.writeFile(filePath, output, { encoding: "utf8" });
      await fs.stat(filePath);
   }

   return files;
}
