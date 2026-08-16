package duckdb

import (
	"context"
	"fmt"
	"strings"
)

// GetSchema introspects DuckDB tables, views, columns, keys, relationships, and enum types.
func (e *Executor) GetSchema(ctx context.Context, schemas []string) (*Schema, error) {
	if len(schemas) == 0 {
		return nil, fmt.Errorf("duckdb: at least one schema is required")
	}
	placeholders := make([]string, len(schemas))
	args := make([]any, len(schemas))
	for index, schema := range schemas {
		placeholders[index] = fmt.Sprintf("$%d", index+1)
		args[index] = schema
	}
	in := strings.Join(placeholders, ", ")

	tables, err := e.readTables(ctx, in, args)
	if err != nil {
		return nil, err
	}
	index := make(map[string]*Table, len(tables))
	for tableIndex := range tables {
		table := &tables[tableIndex]
		index[schemaTableKey(table.TableSchema, table.TableName)] = table
	}
	if err := e.readColumns(ctx, in, args, index); err != nil {
		return nil, err
	}
	if err := e.readPrimaryKeys(ctx, in, args, index); err != nil {
		return nil, err
	}
	if err := e.readForeignKeys(ctx, in, args, index); err != nil {
		return nil, err
	}
	enums, err := e.readEnums(ctx, in, args)
	if err != nil {
		return nil, err
	}
	return &Schema{Tables: tables, Enums: enums}, nil
}

func (e *Executor) readTables(ctx context.Context, in string, args []any) ([]Table, error) {
	rows, err := e.db.QueryContext(ctx, `SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema IN (`+in+`) ORDER BY table_schema, table_name`, args...)
	if err != nil {
		return nil, fmt.Errorf("duckdb: table introspection failed: %w", err)
	}
	defer rows.Close()
	var tables []Table
	for rows.Next() {
		var table Table
		var tableType string
		if err := rows.Scan(&table.TableSchema, &table.TableName, &tableType); err != nil {
			return nil, fmt.Errorf("duckdb: table metadata scan failed: %w", err)
		}
		if tableType == "VIEW" {
			table.TableType = "view"
		} else {
			table.TableType = "table"
		}
		table.Columns = []Column{}
		table.PrimaryKeys = []PrimaryKey{}
		tables = append(tables, table)
	}
	return tables, rows.Err()
}

func (e *Executor) readColumns(ctx context.Context, in string, args []any, tables map[string]*Table) error {
	rows, err := e.db.QueryContext(ctx, `SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default, ordinal_position, numeric_precision_radix FROM information_schema.columns WHERE table_schema IN (`+in+`) ORDER BY table_schema, table_name, ordinal_position`, args...)
	if err != nil {
		return fmt.Errorf("duckdb: column introspection failed: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var column Column
		if err := rows.Scan(&column.TableSchema, &column.TableName, &column.ColumnName, &column.DataType, &column.IsNullable, &column.ColumnDefault, &column.OrdinalPosition, &column.NumericPrecisionRadix); err != nil {
			return fmt.Errorf("duckdb: column metadata scan failed: %w", err)
		}
		if table := tables[schemaTableKey(column.TableSchema, column.TableName)]; table != nil {
			if table.TableType == "table" {
				column.IsUpdatable = "YES"
			} else {
				column.IsUpdatable = "NO"
			}
			table.Columns = append(table.Columns, column)
		}
	}
	return rows.Err()
}

func (e *Executor) readPrimaryKeys(ctx context.Context, in string, args []any, tables map[string]*Table) error {
	query := `SELECT kcu.constraint_name, kcu.table_schema, kcu.table_name, kcu.column_name, kcu.ordinal_position FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_schema = kcu.constraint_schema AND tc.constraint_name = kcu.constraint_name WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema IN (` + in + `) ORDER BY kcu.table_schema, kcu.table_name, kcu.ordinal_position`
	rows, err := e.db.QueryContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("duckdb: primary-key introspection failed: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var key PrimaryKey
		if err := rows.Scan(&key.ConstraintName, &key.TableSchema, &key.TableName, &key.ColumnName, &key.OrdinalPosition); err != nil {
			return fmt.Errorf("duckdb: primary-key metadata scan failed: %w", err)
		}
		if table := tables[schemaTableKey(key.TableSchema, key.TableName)]; table != nil {
			table.PrimaryKeys = append(table.PrimaryKeys, key)
		}
	}
	return rows.Err()
}

func (e *Executor) readForeignKeys(ctx context.Context, in string, args []any, tables map[string]*Table) error {
	query := `SELECT source.constraint_name, source.table_schema, source.table_name, source.column_name, target.table_schema, target.table_name, target.column_name FROM information_schema.referential_constraints rc JOIN information_schema.key_column_usage source ON rc.constraint_schema = source.constraint_schema AND rc.constraint_name = source.constraint_name JOIN information_schema.key_column_usage target ON rc.unique_constraint_schema = target.constraint_schema AND rc.unique_constraint_name = target.constraint_name AND source.position_in_unique_constraint = target.ordinal_position WHERE source.table_schema IN (` + in + `) ORDER BY source.table_schema, source.table_name, source.ordinal_position`
	rows, err := e.db.QueryContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("duckdb: foreign-key introspection failed: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var key ForeignKey
		if err := rows.Scan(&key.ConstraintName, &key.TableSchema, &key.TableName, &key.ColumnName, &key.ReferencedTableSchema, &key.ReferencedTableName, &key.ReferencedColumnName); err != nil {
			return fmt.Errorf("duckdb: foreign-key metadata scan failed: %w", err)
		}
		if table := tables[schemaTableKey(key.TableSchema, key.TableName)]; table != nil {
			table.ForeignKeys = append(table.ForeignKeys, key)
		}
	}
	return rows.Err()
}

func (e *Executor) readEnums(ctx context.Context, in string, args []any) ([]Enum, error) {
	rows, err := e.db.QueryContext(ctx, `SELECT schema_name, type_name, labels FROM duckdb_types() WHERE logical_type = 'ENUM' AND labels IS NOT NULL AND schema_name IN (`+in+`) ORDER BY schema_name, type_name`, args...)
	if err != nil {
		return nil, fmt.Errorf("duckdb: enum introspection failed: %w", err)
	}
	defer rows.Close()
	var enums []Enum
	for rows.Next() {
		var enum Enum
		var labels any
		if err := rows.Scan(&enum.EnumSchema, &enum.EnumName, &labels); err != nil {
			return nil, fmt.Errorf("duckdb: enum metadata scan failed: %w", err)
		}
		switch current := labels.(type) {
		case []string:
			enum.EnumValues = make([]EnumValue, len(current))
			for index, label := range current {
				enum.EnumValues[index] = EnumValue{EnumLabel: label}
			}
		case []any:
			enum.EnumValues = make([]EnumValue, len(current))
			for index, label := range current {
				value, ok := label.(string)
				if !ok {
					return nil, fmt.Errorf("duckdb: enum label has unsupported type %T", label)
				}
				enum.EnumValues[index] = EnumValue{EnumLabel: value}
			}
		default:
			return nil, fmt.Errorf("duckdb: enum labels have unsupported type %T", labels)
		}
		enums = append(enums, enum)
	}
	return enums, rows.Err()
}

func schemaTableKey(schema, table string) string {
	return schema + "\x00" + table
}
