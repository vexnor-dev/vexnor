import { SqlParam, SqlParamShape } from "./sql-param.js";
import { ARGS, PARAMS } from "#/core/sql-base.js";

export class SqlParamRef<T extends { Name: string; Type: unknown }> extends SqlParam<T> {
   declare readonly [PARAMS]: SqlParamShape<T["Name"], T["Type"]>;
   declare readonly [ARGS]?: T["Type"];

   readonly getValue: (<Params, Value>(params: Params) => Value) | null;

   constructor(args: Pick<SqlParamRef<T>, "name" | "getValue">) {
      super(args);
      this.getValue = args.getValue ?? null;
   }
}
