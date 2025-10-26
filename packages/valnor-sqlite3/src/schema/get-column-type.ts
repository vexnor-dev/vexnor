import { SqlColumnInfo, SqlColumnType, SqlLiteralType } from "valnor/plugin";

export function getColumnType(col: SqlColumnInfo): SqlColumnType {
   const lowerType = col.udt_name?.toLowerCase() || "";

   if (lowerType.includes("int")) {
      return { type: SqlLiteralType.Number };
   }
   if (lowerType.includes("text") || lowerType.includes("char") || lowerType.includes("varchar")) {
      return { type: SqlLiteralType.String };
   }
   if (lowerType.includes("real") || lowerType.includes("float") || lowerType.includes("double")) {
      return { type: SqlLiteralType.Number };
   }
   if (lowerType.includes("blob")) {
      return { type: SqlLiteralType.String };
   }
   if (lowerType.includes("bool")) {
      return { type: SqlLiteralType.Boolean };
   }
   if (lowerType.includes("date") || lowerType.includes("time")) {
      return { type: SqlLiteralType.Date };
   }

   return { type: SqlLiteralType.String };
}
