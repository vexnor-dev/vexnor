package vexnor

import "testing"

func TestDuckDBDialectUsesNumberedParameters(t *testing.T) {
	query := &QueryDefinition{
		Name: "duckdb-parameters",
		Hash: "duckdb-parameters",
		Template: TemplateNodes{
			&TextNode{Value: "SELECT "},
			&ParamNode{Name: "first"},
			&TextNode{Value: ", "},
			&ParamNode{Name: "second"},
		},
	}

	result, err := NewSqlBuilder("duckdb").Build(query, map[string]any{
		"first":  "one",
		"second": "two",
	})
	if err != nil {
		t.Fatalf("build DuckDB query: %v", err)
	}
	if result.Text != "SELECT $1, $2" {
		t.Fatalf("DuckDB SQL = %q, want %q", result.Text, "SELECT $1, $2")
	}
}
