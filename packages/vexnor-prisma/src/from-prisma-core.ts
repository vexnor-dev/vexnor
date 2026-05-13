import { newSqlTable, SqlTableExtended } from "vexnor";
import { getDialectFromPrismaProvider } from "./dialect.js";
import { PrismaModel } from "./prisma-dmmf-types.js";

type RecordAny = Record<string, unknown>;
type InsertLike<TSelect extends RecordAny> = { [K in keyof TSelect]?: unknown };
type UpdateLike<TSelect extends RecordAny> = { [K in keyof TSelect]?: unknown };

export type FromPrismaModelResult<
   TSelect extends RecordAny,
   TInsert extends InsertLike<TSelect>,
   TUpdate extends UpdateLike<TSelect>,
> = SqlTableExtended<{
   Select: TSelect;
   Insert: TInsert;
   Update: TUpdate;
   Delete: true;
}>;

export type FromPrismaViewResult<TSelect extends RecordAny> = SqlTableExtended<{
   Select: TSelect;
}>;

export type FromPrismaOptions = {
   provider?: string;
   dialect?: string;
   schema?: string | null;
};

function resolveDialect(options?: FromPrismaOptions): string {
   if (options?.dialect) return options.dialect;
   if (options?.provider) return getDialectFromPrismaProvider(options.provider);
   return "sql";
}

function crudTable() {
   return {
      select: true,
      insert: true,
      update: true,
      delete: true,
   } as const;
}

function crudView() {
   return {
      select: true,
      insert: false,
      update: false,
      delete: false,
   } as const;
}

export function buildPrismaTable<
   TSelect extends RecordAny,
   TInsert extends InsertLike<TSelect>,
   TUpdate extends UpdateLike<TSelect>,
>(
   model: PrismaModel,
   options?: FromPrismaOptions,
): FromPrismaModelResult<TSelect, TInsert, TUpdate> {
   const columns = {} as Record<keyof TSelect, string>;
   const pk: string[] = [];

   for (const field of model.fields) {
      if (field.kind !== "scalar") continue;
      (columns as Record<string, string>)[field.name] = field.dbName ?? field.name;
      if (field.isId) pk.push(field.name);
   }

   if (model.primaryKey?.fields?.length) {
      for (const field of model.primaryKey.fields) {
         if (!pk.includes(field)) pk.push(field);
      }
   }

   return newSqlTable<{
      Select: TSelect;
      Insert: TInsert;
      Update: TUpdate;
      Delete: true;
   }>({
      tableInfo: { name: model.dbName ?? model.name, schema: options?.schema ?? model.schema ?? null },
      pk,
      columns,
      dialect: resolveDialect(options),
      crud: crudTable() as never,
   }) as FromPrismaModelResult<TSelect, TInsert, TUpdate>;
}

export function buildPrismaView<TSelect extends RecordAny>(
   model: PrismaModel,
   options?: FromPrismaOptions,
): FromPrismaViewResult<TSelect> {
   const columns = {} as Record<keyof TSelect, string>;
   const pk: string[] = [];

   for (const field of model.fields) {
      if (field.kind !== "scalar") continue;
      (columns as Record<string, string>)[field.name] = field.dbName ?? field.name;
   }

   return newSqlTable<{ Select: TSelect }>({
      tableInfo: { name: model.dbName ?? model.name, schema: options?.schema ?? model.schema ?? null },
      pk,
      columns,
      dialect: resolveDialect(options),
      crud: crudView() as never,
   }) as FromPrismaViewResult<TSelect>;
}
