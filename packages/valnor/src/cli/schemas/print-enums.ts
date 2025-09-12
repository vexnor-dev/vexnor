import { writeFile } from "fs/promises";
import path from "path";
import to from "to-case";
import { groupBy, SqlEnumInfo, SqlOutputFile } from "../types/index.js";
import { getCodegenContext } from "../codegen-context.js";
import { ok } from "assert";

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
         const enumTypeName = `${to.pascal(enum_name)}Udt_`;
         writer.write(`export type ${enumTypeName} = `);
         enum_values.forEach(({ enum_label }, i) => {
            if (i > 0) writer.write(" | ");
            writer.quote();
            writer.write(enum_label);
            writer.quote();
         });
         writer.blankLine();

         writer.write(`export enum ${to.pascal(enum_name)}Udt`).block(() => {
            enum_values.forEach(({ enum_label }) => {
               writer
                  .write(enum_label.toUpperCase())
                  .space()
                  .write("=")
                  .space()
                  .quote()
                  .write(enum_label)
                  .quote()
                  .write(", ")
                  .newLine();
            });
         });
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
