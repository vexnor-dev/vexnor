import { SqlColumnInfo, SqlColumnType, SqlLiteralType } from "vexnor/plugin";

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
      case "json":
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
         return { type: SqlLiteralType.String };
      case "binary":
      case "varbinary":
      case "image":
      case "rowversion":
      case "timestamp":
         return { type: SqlLiteralType.Buffer };
      case "time":
      case "date":
      case "datetime":
      case "datetime2":
      case "smalldatetime":
      case "datetimeoffset":
         return { type: SqlLiteralType.Date };
      case "bit":
         return { type: SqlLiteralType.Boolean };
      default:
         return { type: SqlLiteralType.Udt, udt: udt_name };
   }
}
