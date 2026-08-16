import { SqlColumnInfo, SqlColumnType, SqlLiteralType } from "@vexnor/core/plugin";
import { parseDuckDBType } from "#src/schema/parse-duckdb-type.js";

export function getColumnType(column: SqlColumnInfo): SqlColumnType {
   const typeName = (column.data_type ?? column.udt_name ?? "").trim();
   const dataType = typeName.toUpperCase();

   if (dataType.startsWith("STRUCT(") || dataType.startsWith("MAP(") || dataType.startsWith("UNION(") || dataType.endsWith("[]") || /\[[0-9]+\]$/.test(dataType)) {
      const typeTree = parseDuckDBType(typeName);
      return {
         type: SqlLiteralType.Json,
         ...(typeTree.kind === "list" ? { isArray: true } : {}),
         typeTree,
      };
   }
   if (dataType === "VARIANT") {
      return { type: SqlLiteralType.Json };
   }
   if (dataType.startsWith("ENUM(")) {
      return { type: SqlLiteralType.Udt, udt: column.udt_name ?? column.domain_name ?? dataType };
   }
   if (dataType.startsWith("DECIMAL(") || dataType.startsWith("NUMERIC(")) {
      return { type: SqlLiteralType.String };
   }

   switch (dataType) {
      case "BOOLEAN":
      case "BOOL":
      case "LOGICAL":
         return { type: SqlLiteralType.Boolean };
      case "TINYINT":
      case "SMALLINT":
      case "INTEGER":
      case "INT":
      case "UTINYINT":
      case "USMALLINT":
      case "UINTEGER":
      case "FLOAT":
      case "REAL":
      case "DOUBLE":
         return { type: SqlLiteralType.Number };
      case "BIGINT":
      case "HUGEINT":
      case "UBIGINT":
      case "UHUGEINT":
      case "BIGNUM":
         return { type: SqlLiteralType.BigInt };
      case "DECIMAL":
      case "NUMERIC":
      case "VARCHAR":
      case "TEXT":
      case "CHAR":
      case "BPCHAR":
      case "STRING":
      case "UUID":
      case "TIME":
      case "TIME WITH TIME ZONE":
      case "TIMETZ":
      case "INTERVAL":
      case "BIT":
      case "GEOMETRY":
         return { type: SqlLiteralType.String };
      case "BLOB":
      case "BYTEA":
      case "BINARY":
      case "VARBINARY":
         return { type: SqlLiteralType.Buffer };
      case "DATE":
      case "TIMESTAMP":
      case "TIMESTAMP_S":
      case "TIMESTAMP_MS":
      case "TIMESTAMP_NS":
      case "TIMESTAMP WITH TIME ZONE":
      case "TIMESTAMPTZ":
         return { type: SqlLiteralType.Date };
      case "JSON":
         return { type: SqlLiteralType.Json };
      default:
         if (column.data_type === "USER-DEFINED" && (column.udt_name || column.domain_name)) {
            return { type: SqlLiteralType.Udt, udt: column.udt_name ?? column.domain_name };
         }
         return { type: SqlLiteralType.Unknown };
   }
}
