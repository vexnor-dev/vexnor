import { SqlColumnInfo, SqlColumnType, SqlLiteralType } from "@vexnor/core/plugin";

/**
 * Get the column type
 * @param udt_name
 * @param numeric_precision_radix
 * @param domain_name
 * @param data_type
 */
export function getColumnType({
   udt_name,
   numeric_precision_radix,
   domain_name,
   data_type,
}: SqlColumnInfo): SqlColumnType {
   switch (udt_name) {
      case "uuid":
      case "text":
      case "varchar":
      case "bpchar":
         return { type: SqlLiteralType.String };
      case "json":
      case "jsonb":
         return { type: SqlLiteralType.Json };
      case "xml":
      case "inet":
      case "cidr":
      case "macaddr":
      case "macaddr8":
      case "bit":
      case "varbit":
         return { type: SqlLiteralType.String };
      case "interval":
         return { type: SqlLiteralType.Custom, tsTypeSelect: "vexnorPostgres.Interval", tsTypeInsert: "string", tsImport: `import type * as vexnorPostgres from "@vexnor/postgres";` };
      case "time":
      case "timetz":
      case "money":
         return { type: SqlLiteralType.String };
      case "numeric":
         if (numeric_precision_radix === 10) return { type: SqlLiteralType.String };
         return { type: SqlLiteralType.Number };
      case "int2":
      case "int4":
      case "float4":
      case "float8":
         return { type: SqlLiteralType.Number };
      case "int8":
         return { type: SqlLiteralType.String };
      case "oid":
         return { type: SqlLiteralType.Number };
      case "xid":
      case "xid8":
      case "name":
      case "pg_lsn":
      case "tsvector":
      case "tsquery":
      case "line":
      case "lseg":
      case "box":
      case "path":
      case "polygon":
         return { type: SqlLiteralType.String };
      case "point":
         return { type: SqlLiteralType.Custom, tsTypeSelect: "vexnorPostgres.Point", tsTypeInsert: "string", tsImport: `import type * as vexnorPostgres from "@vexnor/postgres";` };
      case "circle":
         return { type: SqlLiteralType.Custom, tsTypeSelect: "vexnorPostgres.Circle", tsTypeInsert: "string", tsImport: `import type * as vexnorPostgres from "@vexnor/postgres";` };
      case "bytea":
         return { type: SqlLiteralType.Buffer };
      case "date":
      case "timestamp":
      case "timestamptz":
         return { type: SqlLiteralType.Date };
      case "bool":
         return { type: SqlLiteralType.Boolean };
      default:
         if (data_type === "USER-DEFINED") return { type: SqlLiteralType.Udt, udt: udt_name ?? domain_name };
         return { type: SqlLiteralType.Unknown };
   }
}
