import { Sql } from "../sql-base.js";
import { InferTable$RowBySelect } from "./infer-types.js";

export type SqlOutAny = ISqlColumnAny | SqlOutRowAny;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ISqlColumnAny = ISqlColumn<any>;

export type ISqlColumn<T extends { Key: string; Type?: unknown }> = Sql & {
   readonly key: T["Key"];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlOutRowAny = SqlOutRow<any>;

export type SqlOutRow<T extends { Row: Record<string, unknown> }> = Sql & {
   readonly $$row: InferTable$RowBySelect<T["Row"]>;
};
