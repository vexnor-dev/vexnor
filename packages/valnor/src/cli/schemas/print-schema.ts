import fs from "fs";
import path from "path";
import { ok } from "assert";
import to from "to-case";
import { groupBy } from "../types/index.js";
import { getCodegenContext, SqlOutputFile } from "../../plugin/index.js";
import { writeSchemaImports } from "./write-schema-imports.js";
import { writeSchemaNew } from "./write-schema-new.js";

export interface WriteSchemaArgs {
   outDir: string;
   table_schema: string;
   files: SqlOutputFile[];
}

export async function printSchema({ outDir, table_schema, files }: WriteSchemaArgs): Promise<SqlOutputFile> {
   const { newWriter } = getCodegenContext();
   const writer = newWriter();

   writeSchemaImports(writer, files);
   writeSchemaNew(writer, { schema: table_schema, files });

   const fileName = `${to.snake(table_schema)}.schema`;
   await fs.promises.writeFile(path.join(outDir, `${fileName}.ts`), writer.toString());
   return {
      moduleName: table_schema,
      fileName,
      schemaName: table_schema,
   };
}

export interface WriteSchemasArgs {
   files: SqlOutputFile[];
}

export async function printSchemas({ files }: WriteSchemasArgs): Promise<SqlOutputFile[]> {
   const { outDir } = getCodegenContext();
   const filesBySchema = groupBy(files, (file) => file.schemaName);
   const results = [];
   for (const [schema, files] of Object.entries(filesBySchema)) {
      ok(files?.length, `files not found for schema: ${schema}`);
      ok(files);
      const schemaFile = await printSchema({
         outDir,
         files,
         table_schema: schema,
      });
      results.push(schemaFile);
   }

   return results;
}
