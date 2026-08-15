import { SqlColumnTypeTree, SqlLiteralType } from "@vexnor/core/plugin";

export function parseDuckDBType(input: string): SqlColumnTypeTree {
   return new DuckDBTypeParser(input).parse();
}

class DuckDBTypeParser {
   private index = 0;

   constructor(private readonly input: string) {}

   parse(): SqlColumnTypeTree {
      const result = this.parseType();
      this.skipWhitespace();
      if (this.index !== this.input.length) {
         throw new TypeError(`Unexpected DuckDB type syntax at position ${this.index}: ${this.input}`);
      }
      return result;
   }

   private parseType(): SqlColumnTypeTree {
      this.skipWhitespace();
      const start = this.index;
      const keyword = this.readBareToken().toUpperCase();
      this.skipWhitespace();

      let result: SqlColumnTypeTree;
      switch (keyword) {
         case "STRUCT":
            if (this.peek() !== "(") {
               this.index = start;
               result = this.parseScalar();
               break;
            }
            result = { kind: "struct", fields: this.parseFields() };
            break;
         case "MAP": {
            if (this.peek() !== "(") {
               this.index = start;
               result = this.parseScalar();
               break;
            }
            this.expect("(");
            const key = this.parseType();
            this.expect(",");
            const value = this.parseType();
            this.expect(")");
            result = { kind: "map", key, value };
            break;
         }
         case "UNION":
            if (this.peek() !== "(") {
               this.index = start;
               result = this.parseScalar();
               break;
            }
            result = { kind: "union", members: this.parseFields() };
            break;
         default:
            this.index = start;
            result = this.parseScalar();
      }

      this.skipWhitespace();
      while (this.peek() === "[") {
         this.index++;
         const lengthStart = this.index;
         while (/\d/.test(this.peek() ?? "")) this.index++;
         const lengthText = this.input.slice(lengthStart, this.index);
         this.expect("]");
         result = {
            kind: "list",
            value: result,
            ...(lengthText ? { length: Number(lengthText) } : {}),
         };
         this.skipWhitespace();
      }

      return result;
   }

   private parseFields(): Extract<SqlColumnTypeTree, { kind: "struct" }>["fields"] {
      this.expect("(");
      const fields: Extract<SqlColumnTypeTree, { kind: "struct" }>["fields"] = [];
      this.skipWhitespace();
      while (this.peek() !== ")") {
         const name = this.readIdentifier();
         if (!name) throw new TypeError(`Missing DuckDB field name at position ${this.index}: ${this.input}`);
         this.skipWhitespace();
         fields.push({ name, value: this.parseType() });
         this.skipWhitespace();
         if (this.peek() !== ",") break;
         this.index++;
         this.skipWhitespace();
      }
      this.expect(")");
      return fields;
   }

   private parseScalar(): SqlColumnTypeTree {
      const start = this.index;
      let parentDepth = 0;
      let quote: "'" | '"' | null = null;

      while (this.index < this.input.length) {
         const character = this.input[this.index]!;
         if (quote) {
            if (character === quote) {
               if (this.input[this.index + 1] === quote) {
                  this.index += 2;
                  continue;
               }
               quote = null;
            }
            this.index++;
            continue;
         }
         if (character === "'" || character === '"') {
            quote = character;
            this.index++;
            continue;
         }
         if (character === "(") {
            parentDepth++;
            this.index++;
            continue;
         }
         if (character === ")") {
            if (parentDepth === 0) break;
            parentDepth--;
            this.index++;
            continue;
         }
         if (parentDepth === 0 && (character === "," || character === "[")) break;
         this.index++;
      }

      const typeName = this.input.slice(start, this.index).trim();
      if (!typeName) throw new TypeError(`Missing DuckDB type at position ${start}: ${this.input}`);
      return scalarType(typeName);
   }

   private readIdentifier(): string {
      this.skipWhitespace();
      if (this.peek() !== '"') return this.readBareToken();

      this.index++;
      let result = "";
      while (this.index < this.input.length) {
         const character = this.input[this.index++]!;
         if (character !== '"') {
            result += character;
            continue;
         }
         if (this.peek() === '"') {
            result += '"';
            this.index++;
            continue;
         }
         return result;
      }
      throw new TypeError(`Unterminated DuckDB identifier: ${this.input}`);
   }

   private readBareToken(): string {
      const start = this.index;
      while (this.index < this.input.length && !/[\s(),[\]]/.test(this.input[this.index]!)) {
         this.index++;
      }
      return this.input.slice(start, this.index);
   }

   private expect(character: string): void {
      this.skipWhitespace();
      if (this.peek() !== character) {
         throw new TypeError(`Expected "${character}" at position ${this.index}: ${this.input}`);
      }
      this.index++;
   }

   private peek(): string | undefined {
      return this.input[this.index];
   }

   private skipWhitespace(): void {
      while (/\s/.test(this.peek() ?? "")) this.index++;
   }
}

function scalarType(typeName: string): SqlColumnTypeTree {
   const dataType = typeName.toUpperCase();
   if (dataType.startsWith("ENUM(")) {
      return { kind: "scalar", type: SqlLiteralType.Udt, udt: typeName };
   }
   if (dataType.startsWith("DECIMAL(") || dataType.startsWith("NUMERIC(")) {
      return { kind: "scalar", type: SqlLiteralType.String };
   }

   switch (dataType) {
      case "BOOLEAN":
      case "BOOL":
      case "LOGICAL":
         return { kind: "scalar", type: SqlLiteralType.Boolean };
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
         return { kind: "scalar", type: SqlLiteralType.Number };
      case "BIGINT":
      case "HUGEINT":
      case "UBIGINT":
      case "UHUGEINT":
      case "BIGNUM":
         return { kind: "scalar", type: SqlLiteralType.BigInt };
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
         return { kind: "scalar", type: SqlLiteralType.String };
      case "BLOB":
      case "BYTEA":
      case "BINARY":
      case "VARBINARY":
         return { kind: "scalar", type: SqlLiteralType.Buffer };
      case "DATE":
      case "TIMESTAMP":
      case "TIMESTAMP_S":
      case "TIMESTAMP_MS":
      case "TIMESTAMP_NS":
      case "TIMESTAMP WITH TIME ZONE":
      case "TIMESTAMPTZ":
         return { kind: "scalar", type: SqlLiteralType.Date };
      case "JSON":
         return { kind: "scalar", type: SqlLiteralType.Json };
      default:
         return { kind: "scalar", type: SqlLiteralType.Unknown };
   }
}
