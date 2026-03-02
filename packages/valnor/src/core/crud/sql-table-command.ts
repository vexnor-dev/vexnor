import { SqlTable } from "../schema/index.js";

export abstract class SqlTableCommand<
   T extends {
      Select: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Delete?: boolean;
   },
> {
   constructor(public readonly table: SqlTable<T>) {}
}
