import fs from "fs";
import path from "path";
import { getCodegenContext } from "./codegen-context.js";
import { LibraryOutputFile, SqlOutputFile } from "#src/plugin/plugin.js";

const writeFile = fs.promises.writeFile;

export interface WriteIndexArgs {
   libraryFiles: LibraryOutputFile[];
   schemaFiles: Pick<SqlOutputFile, "moduleName" | "fileName">[];
}

const RESERVED_WORDS = new Set(["public", "private", "protected", "static", "class", "enum", "export", "import", "default", "return", "function", "new", "delete", "typeof", "void", "interface", "type"]);

export async function writeIndex({ schemaFiles, libraryFiles }: WriteIndexArgs): Promise<void> {
   const { outDir, newWriter } = getCodegenContext();
   const writer = newWriter();
   const sortedSchemaFiles = [...schemaFiles].sort((left, right) => left.fileName.localeCompare(right.fileName));
   for (const file of sortedSchemaFiles) {
      const alias = RESERVED_WORDS.has(file.moduleName) ? `${file.moduleName}Schema` : file.moduleName;
      writer.writeLine(`export * as ${alias} from "./${file.fileName}.js";`);
   }

   const sortedLibraryFiles = [...libraryFiles].sort((left, right) => left.fileName.localeCompare(right.fileName));
   for (const file of sortedLibraryFiles) {
      writer.writeLine(`export * from "./${file.fileName}.js";`);
   }

   await writeFile(path.join(outDir, "index.ts"), writer.toString());
}
