import { writeFile } from "fs/promises";
import path from "path";
import to from "to-case";
import { groupBy } from "#src/cli/codegen/types/group-by.js";
import { ok } from "#src/lib/assert.js";
import { SqlOutputFile } from "#src/plugin/plugin.js";
import { getCodegenContext } from "#src/cli/codegen/codegen-context.js";
import type { SchemaCatalogEnum } from "#src/schema/schema-catalog.js";

export interface WriteEnumsAgs {
   enums: SchemaCatalogEnum[];
}

export async function printEnums({ enums }: WriteEnumsAgs): Promise<SqlOutputFile[]> {
   const results: SqlOutputFile[] = [];
   const { outDir, newWriter } = getCodegenContext();

   const enumsBySchema = groupBy(enums, (entry) => entry.schema);
   for (const [schema, enums] of Object.entries(enumsBySchema)) {
      ok(enums?.length, `No enums found for schema: ${schema}`);
      const writer = newWriter();
      for (const { name, values } of enums) {
         const udtName = `${to.pascal(name)}Udt`;
         writer.write(`export const ${udtName} =`).inlineBlock(() => {
            values.forEach((value) => {
               const key = value.toUpperCase();
               const needsQuote = !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
               writer
                  .write(needsQuote ? `"${key}"` : key)
                  .write(": ")
                  .quote()
                  .write(value)
                  .quote()
                  .write(",")
                  .newLine();
            });
         });
         writer.write(" as const;");
         writer.blankLine();
         writer.write(`export type ${udtName} = (typeof ${udtName})[keyof typeof ${udtName}];`);
         writer.blankLine();
      }

      const output = writer.toString();
      const fileName = `${schema}-enums`;
      const filePath = path.join(outDir, `${fileName}.ts`);
      await writeFile(filePath, output, { encoding: "utf8" });
      results.push({
         fileName,
         moduleName: fileName,
         schemaName: schema,
      });
   }

   return results;
}
