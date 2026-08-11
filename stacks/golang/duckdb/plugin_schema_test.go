package duckdb

import (
	"context"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/vexnor-dev/vexnor/stacks/golang/vexnor"
)

func TestConnectionConfigModesAndValidation(t *testing.T) {
	tests := []struct {
		name   string
		config ConnectionConfig
		path   string
		error  string
	}{
		{name: "memory", config: ConnectionConfig{Mode: "memory"}, path: ":memory:"},
		{name: "file", config: ConnectionConfig{Mode: "file", Path: "analytics.duckdb"}, path: "analytics.duckdb"},
		{name: "MotherDuck", config: ConnectionConfig{Mode: "motherduck", Database: "analytics", Token: "secret token"}, path: "md:analytics?motherduck_token=secret+token"},
		{name: "URI", config: ConnectionConfig{URI: "custom.duckdb"}, path: "custom.duckdb"},
		{name: "empty file", config: ConnectionConfig{Mode: "file"}, error: "duckdb: file path must not be empty"},
		{name: "empty MotherDuck database", config: ConnectionConfig{Mode: "motherduck", Token: "token"}, error: "duckdb: MotherDuck database must not be empty"},
		{name: "empty MotherDuck token", config: ConnectionConfig{Mode: "motherduck", Database: "analytics"}, error: "duckdb: MotherDuck token must not be empty"},
		{name: "unknown", config: ConnectionConfig{Mode: "server"}, error: `duckdb: unsupported connection mode "server"`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			path, err := resolveConnectionPath(test.config)
			if test.error != "" {
				if err == nil || err.Error() != test.error {
					t.Fatalf("error = %v, want %q", err, test.error)
				}
				return
			}
			if err != nil || path != test.path {
				t.Fatalf("path, error = %q, %v; want %q, nil", path, err, test.path)
			}
		})
	}

	if _, err := NewFromPath(""); err == nil {
		t.Fatal("expected empty direct path to fail")
	}
	executor, err := Open(ConnectionConfig{Mode: "file", Path: filepath.Join(t.TempDir(), "open.duckdb")})
	if err != nil {
		t.Fatalf("open configured DuckDB: %v", err)
	}
	if err := executor.Close(); err != nil {
		t.Fatalf("close configured DuckDB: %v", err)
	}
}

func TestGetSchemaReturnsTablesViewsColumnsKeysRelationshipsAndEnums(t *testing.T) {
	executor, err := NewMemory()
	if err != nil {
		t.Fatalf("open in-memory DuckDB: %v", err)
	}
	t.Cleanup(func() { _ = executor.Close() })

	if _, err := executor.Execute(context.Background(), &vexnor.SqlBuildResult{Text: `
		CREATE TYPE item_state AS ENUM ('open', 'closed');
		CREATE TABLE parent (parent_id INTEGER PRIMARY KEY);
		CREATE TABLE item (
			item_id INTEGER PRIMARY KEY,
			parent_id INTEGER REFERENCES parent(parent_id),
			state item_state NOT NULL DEFAULT 'open'
		);
		CREATE VIEW open_item AS SELECT * FROM item WHERE state = 'open';
	`}); err != nil {
		t.Fatalf("create schema fixtures: %v", err)
	}

	schema, err := executor.GetSchema(context.Background(), []string{"main"})
	if err != nil {
		t.Fatalf("introspect schema: %v", err)
	}
	if len(schema.Tables) != 3 || len(schema.Enums) != 1 {
		t.Fatalf("schema = %#v", schema)
	}
	var item *Table
	for index := range schema.Tables {
		if schema.Tables[index].TableName == "item" {
			item = &schema.Tables[index]
		}
	}
	if item == nil || len(item.Columns) != 3 || len(item.PrimaryKeys) != 1 || len(item.ForeignKeys) != 1 {
		t.Fatalf("item metadata = %#v", item)
	}
	if item.Columns[0].IsUpdatable != "YES" || item.Columns[0].NumericPrecisionRadix == nil || *item.Columns[0].NumericPrecisionRadix != 2 || item.Columns[2].NumericPrecisionRadix != nil {
		t.Fatalf("column metadata = %#v", item.Columns)
	}
	if !reflect.DeepEqual(schema.Enums[0].EnumValues, []EnumValue{{EnumLabel: "open"}, {EnumLabel: "closed"}}) {
		t.Fatalf("enum values = %#v", schema.Enums[0].EnumValues)
	}
	if _, err := executor.GetSchema(context.Background(), nil); err == nil {
		t.Fatal("expected empty schema list to fail")
	}
}
