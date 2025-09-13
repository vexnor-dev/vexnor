import * as writeSchemaNew from "./write-schema-new.js";
import * as writeSchemaImports from "./write-schema-imports.js";

export const pg = {
   ...writeSchemaNew,
   ...writeSchemaImports,
};
