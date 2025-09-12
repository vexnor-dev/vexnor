import fs from "fs";
import path from "path";
import { SqlOutputFile } from "./types/index.js";
import { getCodegenContext } from "./codegen-context.js";
import { LibraryOutputFile } from "./lib/index.js";

const writeFile = fs.promises.writeFile;

export interface WriteIndexArgs {
   libraryFiles: LibraryOutputFile[];
   schemaFiles: Pick<SqlOutputFile, "moduleName" | "fileName">[];
}

export async function writeIndex({ schemaFiles, libraryFiles }: WriteIndexArgs): Promise<void> {
   const { outDir, newWriter } = getCodegenContext();
   const writer = newWriter();
   for (const file of schemaFiles) {
      writer.writeLine(`export * as ${file.moduleName} from "./${file.fileName}.js";`);
   }

   for (const file of libraryFiles) {
      writer.writeLine(`export * from "./${file.fileName}.js";`);
   }

   await writeFile(path.join(outDir, "index.ts"), writer.toString());
}
