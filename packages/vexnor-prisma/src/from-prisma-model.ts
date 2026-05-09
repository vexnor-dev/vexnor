import { PrismaModel } from "./prisma-dmmf-types.js";
import { FromPrismaModelResult, FromPrismaOptions, FromPrismaViewResult, buildPrismaTable, buildPrismaView } from "./from-prisma-core.js";

type RecordAny = Record<string, unknown>;
type InsertLike<TSelect extends RecordAny> = { [K in keyof TSelect]?: unknown };
type UpdateLike<TSelect extends RecordAny> = { [K in keyof TSelect]?: unknown };

export function fromPrismaModelTable<
   TSelect extends RecordAny,
   TInsert extends InsertLike<TSelect> = InsertLike<TSelect>,
   TUpdate extends UpdateLike<TSelect> = UpdateLike<TSelect>,
>(
   model: PrismaModel,
   options?: FromPrismaOptions,
): FromPrismaModelResult<TSelect, TInsert, TUpdate> {
   return buildPrismaTable<TSelect, TInsert, TUpdate>(model, options);
}

export function fromPrismaModelView<TSelect extends RecordAny>(
   model: PrismaModel,
   options?: FromPrismaOptions,
): FromPrismaViewResult<TSelect> {
   return buildPrismaView<TSelect>(model, options);
}
