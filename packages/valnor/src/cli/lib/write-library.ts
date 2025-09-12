import path from "node:path";
import { getCodegenContext } from "../codegen-context.js";
import fs from "node:fs/promises";
import { SqlOutputFile } from "../types/index.js";

export type LibraryOutputFile = Pick<SqlOutputFile, "fileName">;

export async function writeLibrary(): Promise<LibraryOutputFile[]> {
   const { outDir, driver } = getCodegenContext();
   const filePath = path.resolve(outDir, "postgres-library.ts");
   let output = "";
   const files = [];
   if (driver === "postgres.js") {
      files.push("../../../@templates/types.ts", "../../../@templates/postgres-library.ts");
   }

   for (const file of files) {
      const filePath = path.resolve(new URL(import.meta.url).pathname, file);
      const data = await fs.readFile(filePath, { encoding: "utf8" });
      output += "\n";
      output += data;
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
