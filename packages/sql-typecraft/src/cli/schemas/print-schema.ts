import fs from "fs";
import path from "path";
import { ok } from "assert";
import to from "to-case";
import { groupBy, SqlOutputFile } from "../types/index.js";
import { getCodegenContext } from "../codegen-context.js";
import CodeBlockWriter from "code-block-writer";
import { x } from "../../lib/x.js";
import { postgres } from "./postgres/index.js";
import { pg } from "./pg/index.js";

export interface WriteSchemaArgs {
   outDir: string;
   table_schema: string;
   files: SqlOutputFile[];
}

export async function printSchema({ outDir, table_schema, files }: WriteSchemaArgs): Promise<SqlOutputFile> {
   const { newWriter, driver } = getCodegenContext();
   const writer = newWriter();
   writeSchemaImports(writer, files);
   const { writeSchemaNew } = x(() => {
      switch (driver) {
         case "postgres.js":
            return postgres;
         case "pg":
            return pg;
         default:
            throw new Error(`Unknown driver: ${driver}`);
      }
   });
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

function writeSchemaImports(writer: CodeBlockWriter.default, files: SqlOutputFile[]) {
   files.forEach(({ fileName, tableTypeName }) => {
      if (tableTypeName) {
         writer.writeLine(`export type * from "./${fileName}.js";`);
      } else {
         writer.writeLine(`export * from "./${fileName}.js";`);
      }
   });
   writer.blankLine();
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
