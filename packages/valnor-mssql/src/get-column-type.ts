import { SqlColumnInfo, SqlColumnType, SqlLiteralType } from "valnor/plugin";

/**
 * Get the column type for MS SQL Server
 * @param data_type The data type from INFORMATION_SCHEMA.COLUMNS
 */
export function getColumnType({ udt_name }: SqlColumnInfo): SqlColumnType {
   const lowerType = udt_name?.toLowerCase() || "";
   switch (lowerType) {
      case "uniqueidentifier":
      case "varchar":
      case "nvarchar":
      case "char":
      case "nchar":
      case "text":
      case "ntext":
      case "xml":
         return { type: SqlLiteralType.String };
      case "int":
      case "smallint":
      case "tinyint":
      case "decimal":
      case "numeric":
      case "float":
      case "real":
      case "money":
      case "smallmoney":
         return { type: SqlLiteralType.Number };
      case "bigint":
         return { type: SqlLiteralType.BigInt };
      case "json":
         return { type: SqlLiteralType.String };
      case "date":
      case "datetime":
      case "datetime2":
      case "smalldatetime":
      case "datetimeoffset":
      case "timestamp": // rowversion is a synonym for timestamp
         return { type: SqlLiteralType.Date };
      case "bit":
         return { type: SqlLiteralType.Boolean };
      default:
         // For types like 'binary', 'varbinary', 'image', 'geography', 'geometry', etc.
         // and user-defined types.
         return { type: SqlLiteralType.Udt, udt: udt_name };
   }
}
