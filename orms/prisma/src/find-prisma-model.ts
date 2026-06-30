import { getDMMF } from "@prisma/internals";
import { readFile } from "node:fs/promises";
import { PrismaModel } from "./prisma-dmmf-types.js";

export type FindPrismaModelOptions =
   | { dmmf: { datamodel?: { models?: readonly PrismaModel[] } } }
   | { schemaPath: string }
   | { schema: string };

function stripDatasourceUrlLines(datamodel: string): string {
   return datamodel.replace(/^\s*url\s*=\s*.+$/gm, "");
}

export async function findPrismaModel(modelName: string, options: FindPrismaModelOptions): Promise<PrismaModel> {
   if ("dmmf" in options) {
      const model = options.dmmf?.datamodel?.models?.find((m) => m.name === modelName);
      if (model) return model;
      throw new Error(`Model not found in generated Prisma dmmf: ${modelName}`);
   }

   const datamodel = "schema" in options ? options.schema : await readFile(options.schemaPath, "utf8");

   let dmmf;
   try {
      dmmf = await getDMMF({ datamodel });
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("datasource property `url` is no longer supported")) throw error;
      dmmf = await getDMMF({ datamodel: stripDatasourceUrlLines(datamodel) });
   }

   const models = dmmf?.datamodel?.models as readonly PrismaModel[] | undefined;
   const model = models?.find((m) => m.name === modelName);
   if (!model) throw new Error(`Model not found in Prisma schema: ${modelName}`);
   return model;
}
