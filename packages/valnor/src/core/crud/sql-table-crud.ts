import { SqlQueryAny, SqlQueryExtended } from "../query/index.js";
import { ParamsOf } from "../sql-base.js";
import { Merge } from "../utils/index.js";

/* Find  */
export type SqlTableReadResult<
   T extends { Select: Record<string, unknown> },
   Args extends { where?: SqlQueryAny },
> = Args["where"] extends object
   ? SqlQueryExtended<{ Params: ParamsOf<Args["where"]>; Row: T["Select"] }>
   : SqlQueryExtended<{ Params: void; Row: T["Select"] }>;

export type SqlTableRead<T extends { Select: Record<string, unknown> }> = {
   read<Args extends { where?: SqlQueryAny }>({ where }: Args): SqlTableReadResult<T, Args>;
};

export type SqlTableReadOptional<T> = T extends { Select: Record<string, unknown> } ? SqlTableRead<T> : unknown;

/* Create  */
export type SqlTableCreateParams<T extends { Insert: Record<string, unknown> }> = {
   inserts: T["Insert"][];
};

export type SqlTableCreateResult<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends { from?: SqlQueryAny },
> = Args["from"] extends object
   ? SqlQueryExtended<{
        Row: T["Select"];
        Params: Merge<SqlTableCreateParams<T>, { from: ParamsOf<Args["from"]> }>;
     }>
   : SqlQueryExtended<{
        Row: T["Select"];
        Params: SqlTableCreateParams<T>;
     }>;

export type SqlTableCreate<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> = {
   create<Args extends { from?: SqlQueryAny }>({ from }: Args): SqlTableCreateResult<T, Args>;
};

export type SqlTableCreateOptional<T> = T extends {
   Select: Record<string, unknown>;
   Insert: Record<string, unknown>;
}
   ? SqlTableCreate<T>
   : unknown;

/* Update  */
export type SqlTableUpdateParams<T extends { Update: Record<string, unknown> }> = {
   value: T["Update"];
};

export type SqlTableUpdateResult<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends { where?: SqlQueryAny },
> = Args["where"] extends object
   ? SqlQueryExtended<{
        Params: Merge<SqlTableUpdateParams<T>, { where: ParamsOf<Args["where"]> }>;
        Row: T["Select"];
     }>
   : SqlQueryExtended<{
        Params: SqlTableUpdateParams<T>;
        Row: T["Select"];
     }>;

export type SqlTableUpdate<T extends { Select: Record<string, unknown>; Update: Record<string, unknown> }> = {
   update<Args extends { where?: SqlQueryAny }>({ where }: Args): SqlTableUpdateResult<T, Args>;
};

export type SqlTableUpdateOptional<T> = T extends {
   Select: Record<string, unknown>;
   Update: Record<string, unknown>;
}
   ? SqlTableUpdate<T>
   : unknown;

/* Delete  */
export type SqlTableDeleteResult<Args extends { where?: SqlQueryAny }> = Args["where"] extends SqlQueryAny
   ? SqlQueryExtended<{
        Params: { where: ParamsOf<Args["where"]> };
        Row: void;
     }>
   : SqlQueryExtended<{
        Params: void;
        Row: void;
     }>;
export type SqlTableDelete = {
   delete<Args extends { where?: SqlQueryAny; force?: true }>({ where, force }: Args): SqlTableDeleteResult<Args>;
};

export type SqlTableDeleteOptional<T> = T extends {
   Delete: true;
}
   ? SqlTableDelete
   : unknown;

export type SqlTableCrud<T> = {} & SqlTableReadOptional<T> &
   SqlTableCreateOptional<T> &
   SqlTableUpdateOptional<T> &
   SqlTableDeleteOptional<T>;

//
// const where = sql` ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`;
//
// assertType<Record<keyof SqlTableCreate<never>, null>>({ create: null });
//
// const db: SqlTableCrud<{ Select: IAccountSelect; Insert: IAccountInsert; Update: IAccountUpdate }> = {};
//
// const findOne = db.update({});
// const updateOne = db.update({ where });
// assertType<
//    SqlQueryExtended<{
//       Params: {
//          value: Partial<IAccountInsert>;
//          where: {
//             accountId: string;
//          };
//       };
//       Row: IAccountSelect;
//    }>
// >(updateOne);
