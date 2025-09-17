import path from "node:path";
import { getCodegenContext, LibraryOutputFile } from "../../plugin/index.js";
import fs from "node:fs/promises";

export async function writeLibrary(): Promise<LibraryOutputFile[]> {
   const { outDir, plugin } = getCodegenContext();
   const filePath = path.resolve(outDir, "postgres-library.ts");
   let output = "";
   const files = plugin.getLibrary();

   for (const file of files) {
      const filePath = path.resolve(new URL(import.meta.url).pathname, file.fileName);
      const data = await fs.readFile(filePath, { encoding: "utf8" });
      output += "\n";
      output += data;
   }

   if (!output) {
      return [];
   }

   await fs.writeFile(filePath, output, {
      encoding: "utf8",
   });

   return [
      {
         fileName: "postgres-library",
      },
   ];
}
