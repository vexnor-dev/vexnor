import { Attributes, CreationAttributes, Model, ModelStatic } from "sequelize";
import { newSqlTable, SqlTableExtended } from "@vexnor/core";
import { getDialect } from "#/dialect.js";

type FromSequelizeTableResult<T extends Model> = SqlTableExtended<{
   Select: Attributes<T>;
   Insert: CreationAttributes<T>;
   Update: Partial<CreationAttributes<T>>;
   Delete: true;
}>;

type FromSequelizeViewResult<T extends Model> = SqlTableExtended<{
   Select: Attributes<T>;
}>;

function resolveTableInfo<T extends Model>(
   model: ModelStatic<T>,
   schemaOverride?: string,
): { name: string; schema: string | null } {
   const tableName = model.getTableName();
   if (typeof tableName === "string") {
      return { name: tableName, schema: schemaOverride ?? null };
   }

   return {
      name: tableName.tableName,
      schema: schemaOverride ?? tableName.schema ?? null,
   };
}

function resolveColumns<T extends Model>(model: ModelStatic<T>): { columns: Record<string, string>; pk: string[] } {
   const attrs = model.getAttributes();
   const columns: Record<string, string> = {};

   for (const [jsKey, attr] of Object.entries(attrs)) {
      columns[jsKey] = attr.field ?? jsKey;
   }

   const pk = [...model.primaryKeyAttributes];
   return { columns, pk };
}

function getSequelizeDialect<T extends Model>(model: ModelStatic<T>): string {
   const sequelize = model.sequelize;
   if (!sequelize) {
      throw new Error("fromSequelizeTable: model is not initialized on a Sequelize instance.");
   }
   return getDialect(sequelize.getDialect());
}

/**
 * Converts a Sequelize model definition into a vexnor runtime table.
 */
export function fromSequelizeTable<T extends Model>(
   model: ModelStatic<T>,
   schema?: string,
): FromSequelizeTableResult<T> {
   const { columns, pk } = resolveColumns(model);
   const tableInfo = resolveTableInfo(model, schema);

   return newSqlTable({
      tableInfo,
      pk,
      columns,
      dialect: getSequelizeDialect(model),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      crud: { select: true, insert: true, update: true, delete: true } as any,
   }) as FromSequelizeTableResult<T>;
}

/**
 * Converts a Sequelize view model definition into a vexnor runtime table (select-only).
 */
export function fromSequelizeView<T extends Model>(model: ModelStatic<T>, schema?: string): FromSequelizeViewResult<T> {
   const { columns } = resolveColumns(model);
   const tableInfo = resolveTableInfo(model, schema);

   return newSqlTable({
      tableInfo,
      pk: [],
      columns,
      dialect: getSequelizeDialect(model),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      crud: { select: true, insert: false, update: false, delete: false } as any,
   }) as FromSequelizeViewResult<T>;
}
