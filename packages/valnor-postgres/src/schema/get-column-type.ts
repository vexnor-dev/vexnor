import { SqlColumnInfo, SqlColumnType, SqlLiteralType } from "valnor/plugin";

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
         return { type: SqlLiteralType.String };
      case "numeric":
         if (numeric_precision_radix === 10) return { type: SqlLiteralType.String };
         return { type: SqlLiteralType.Number };
      case "int4":
         return { type: SqlLiteralType.Number };
      case "int8":
         return { type: SqlLiteralType.BigInt };
      case "jsonb":
         return { type: SqlLiteralType.String };
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
