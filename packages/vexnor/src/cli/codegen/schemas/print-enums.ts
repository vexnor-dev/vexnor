import { writeFile } from "fs/promises";
import path from "path";
import to from "to-case";
import { groupBy } from "#src/cli/codegen/types/group-by.js";
import { ok } from "#src/lib/assert.js";
import { SqlEnumInfo, SqlOutputFile } from "#src/plugin/plugin.js";
import { getCodegenContext } from "#src/cli/codegen/codegen-context.js";

export interface WriteEnumsAgs {
   enums: SqlEnumInfo[];
}

export async function printEnums({ enums }: WriteEnumsAgs): Promise<SqlOutputFile[]> {
   const results: SqlOutputFile[] = [];
   const { outDir, newWriter } = getCodegenContext();

   const enumsBySchema = groupBy(enums, (e) => e.enum_schema);
   for (const [schema, enums] of Object.entries(enumsBySchema)) {
      ok(enums?.length, `No enums found for schema: ${schema}`);
      const writer = newWriter();
      for (const { enum_name, enum_values } of enums) {
         const udtName = `${to.pascal(enum_name)}Udt`;
         writer.write(`export const ${udtName} =`).inlineBlock(() => {
            enum_values.forEach(({ enum_label }) => {
               writer
                  .write(enum_label.toUpperCase())
                  .write(": ")
                  .quote()
                  .write(enum_label)
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
