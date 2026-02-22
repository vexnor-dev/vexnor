import { ROW, Sql, TYPE } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlBuildOptions } from "./sql-query-types.js";

export class SqlSelectField<T extends { Key: string; Type: unknown }> extends Sql {
   declare readonly [ROW]: Record<T["Key"], T["Type"]>;
   declare readonly [TYPE]: Record<T["Key"], T["Type"]>;

   readonly key: T["Key"];

   constructor({ key }: { key: T["Key"] }) {
      super({
         id: key,
      });
      this.key = key;
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   build(context: SqlBuildContext, options?: SqlBuildOptions): void {
      context.addStrings(`"${this.key}"`);
   }
}

export function col<T extends Record<string, unknown>>(
   key: Extract<keyof T, string>,
): SqlSelectField<{ Key: Extract<keyof T, string>; Type: T[typeof key] }> {
   return new SqlSelectField({ key });
}
