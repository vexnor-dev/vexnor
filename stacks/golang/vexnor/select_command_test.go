package vexnor_test

import (
	"testing"

	"github.com/vexnor-dev/vexnor/stacks/golang/vexnor"
)

func makeSelectQuery() *vexnor.QueryDefinition {
	cols := vexnor.NewOrderedMap()
	cols.Set("accountId", `"a"."account_id" as "accountId"`)
	cols.Set("email", `"a"."email"`)
	cols.Set("isActive", `"a"."is_active"`)

	return &vexnor.QueryDefinition{
		Name: "test",
		Hash: "abc",
		Row: map[string]*vexnor.ColumnSchema{
			"isActive": {Type: "boolean"},
			"email":    {Type: "text"},
		},
		Template: vexnor.TemplateNodes{
			&vexnor.TextNode{Value: "SELECT "},
			&vexnor.ProjectionNode{
				Param:   "select",
				Columns: cols,
			},
			&vexnor.TextNode{Value: ` FROM "account" AS "a"`},
		},
	}
}

// ─── Base SqlSelectCommand Tests ─────────────────────────────────────────────

func TestSqlSelectCommand_Build_WithoutProjection_ProducesAllColumns(t *testing.T) {
	cmd := vexnor.NewSqlSelectCommand(makeSelectQuery(), "postgresql")
	result, err := cmd.Build(map[string]any{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `SELECT "a"."account_id" as "accountId", "a"."email", "a"."is_active" FROM "account" AS "a"`
	if result.Text != expected {
		t.Errorf("text mismatch:\n  got:  %s\n  want: %s", result.Text, expected)
	}
}

func TestSqlSelectCommand_Build_WithProjection_ProducesSelectedColumns(t *testing.T) {
	cmd := vexnor.NewSqlSelectCommand(makeSelectQuery(), "postgresql")
	params := map[string]any{
		"select": []any{"email", []any{"count", "*", "total"}},
	}
	result, err := cmd.Build(params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `SELECT "a"."email", count(*) as "total" group by "a"."email" FROM "account" AS "a"`
	if result.Text != expected {
		t.Errorf("text mismatch:\n  got:  %s\n  want: %s", result.Text, expected)
	}
}

func TestSqlSelectCommand_TransformAggregateColumn_BaseClass_ReturnsUnchanged(t *testing.T) {
	cmd := vexnor.NewSqlSelectCommand(makeSelectQuery(), "postgresql")
	colType := "boolean"
	result := cmd.TransformAggregateColumn("sum", `"a"."is_active"`, &colType)

	if result != `"a"."is_active"` {
		t.Errorf("expected unchanged column SQL, got: %s", result)
	}
}

// ─── PostgresSqlSelectCommand Tests ──────────────────────────────────────────

func TestPostgresSqlSelectCommand_SumOnBoolean_AppendsCastInt(t *testing.T) {
	cmd := vexnor.NewPostgresSqlSelectCommand(makeSelectQuery())
	params := map[string]any{
		"select": []any{[]any{"sum", "isActive", "activeCount"}},
	}
	result, err := cmd.Build(params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `SELECT sum("a"."is_active"::int) as "activeCount" FROM "account" AS "a"`
	if result.Text != expected {
		t.Errorf("text mismatch:\n  got:  %s\n  want: %s", result.Text, expected)
	}
}

func TestPostgresSqlSelectCommand_AvgOnBoolean_AppendsCastInt(t *testing.T) {
	cmd := vexnor.NewPostgresSqlSelectCommand(makeSelectQuery())
	params := map[string]any{
		"select": []any{[]any{"avg", "isActive", "avgActive"}},
	}
	result, err := cmd.Build(params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `SELECT avg("a"."is_active"::int) as "avgActive" FROM "account" AS "a"`
	if result.Text != expected {
		t.Errorf("text mismatch:\n  got:  %s\n  want: %s", result.Text, expected)
	}
}

func TestPostgresSqlSelectCommand_CountOnBoolean_DoesNotCast(t *testing.T) {
	cmd := vexnor.NewPostgresSqlSelectCommand(makeSelectQuery())
	params := map[string]any{
		"select": []any{[]any{"count", "isActive", "countActive"}},
	}
	result, err := cmd.Build(params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `SELECT count("a"."is_active") as "countActive" FROM "account" AS "a"`
	if result.Text != expected {
		t.Errorf("text mismatch:\n  got:  %s\n  want: %s", result.Text, expected)
	}
}

func TestPostgresSqlSelectCommand_SumOnNonBoolean_DoesNotCast(t *testing.T) {
	cmd := vexnor.NewPostgresSqlSelectCommand(makeSelectQuery())
	params := map[string]any{
		"select": []any{[]any{"sum", "email", "totalEmail"}},
	}
	result, err := cmd.Build(params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `SELECT sum("a"."email") as "totalEmail" FROM "account" AS "a"`
	if result.Text != expected {
		t.Errorf("text mismatch:\n  got:  %s\n  want: %s", result.Text, expected)
	}
}

func TestPostgresSqlSelectCommand_SumOnColumnNotInRowSchema_DoesNotCast(t *testing.T) {
	// accountId is in Columns but NOT in Row schema — colType will be nil
	cmd := vexnor.NewPostgresSqlSelectCommand(makeSelectQuery())
	params := map[string]any{
		"select": []any{[]any{"sum", "accountId", "totalAccounts"}},
	}
	result, err := cmd.Build(params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `SELECT sum("a"."account_id" as "accountId") as "totalAccounts" FROM "account" AS "a"`
	if result.Text != expected {
		t.Errorf("text mismatch:\n  got:  %s\n  want: %s", result.Text, expected)
	}
}

func TestPostgresSqlSelectCommand_TransformAggregateColumn_BooleanSum(t *testing.T) {
	cmd := vexnor.NewPostgresSqlSelectCommand(makeSelectQuery())
	colType := "boolean"
	result := cmd.TransformAggregateColumn("sum", `"a"."is_active"`, &colType)

	expected := `"a"."is_active"::int`
	if result != expected {
		t.Errorf("expected %s, got: %s", expected, result)
	}
}

func TestPostgresSqlSelectCommand_TransformAggregateColumn_BooleanAvg(t *testing.T) {
	cmd := vexnor.NewPostgresSqlSelectCommand(makeSelectQuery())
	colType := "boolean"
	result := cmd.TransformAggregateColumn("avg", `"a"."is_active"`, &colType)

	expected := `"a"."is_active"::int`
	if result != expected {
		t.Errorf("expected %s, got: %s", expected, result)
	}
}

func TestPostgresSqlSelectCommand_TransformAggregateColumn_NilType(t *testing.T) {
	cmd := vexnor.NewPostgresSqlSelectCommand(makeSelectQuery())
	result := cmd.TransformAggregateColumn("sum", `"a"."account_id"`, nil)

	expected := `"a"."account_id"`
	if result != expected {
		t.Errorf("expected %s, got: %s", expected, result)
	}
}

func TestPostgresSqlSelectCommand_TransformAggregateColumn_MinOnBoolean_DoesNotCast(t *testing.T) {
	cmd := vexnor.NewPostgresSqlSelectCommand(makeSelectQuery())
	colType := "boolean"
	result := cmd.TransformAggregateColumn("min", `"a"."is_active"`, &colType)

	expected := `"a"."is_active"`
	if result != expected {
		t.Errorf("expected %s, got: %s", expected, result)
	}
}

// ─── SqlSelectCommand with different dialects ────────────────────────────────

func TestSqlSelectCommand_MssqlDialect(t *testing.T) {
	cmd := vexnor.NewSqlSelectCommand(makeSelectQuery(), "transactsql")
	params := map[string]any{
		"select": []any{"email", []any{"count", "*", "total"}},
	}
	result, err := cmd.Build(params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `SELECT "a"."email", count(*) as "total" group by "a"."email" FROM "account" AS "a"`
	if result.Text != expected {
		t.Errorf("text mismatch:\n  got:  %s\n  want: %s", result.Text, expected)
	}
}

func TestSqlSelectCommand_SqliteDialect(t *testing.T) {
	cmd := vexnor.NewSqlSelectCommand(makeSelectQuery(), "sqlite")
	params := map[string]any{
		"select": []any{"email"},
	}
	result, err := cmd.Build(params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `SELECT "a"."email" FROM "account" AS "a"`
	if result.Text != expected {
		t.Errorf("text mismatch:\n  got:  %s\n  want: %s", result.Text, expected)
	}
}

// ─── Interface compliance ────────────────────────────────────────────────────

func TestSqlSelectCommand_ImplementsInterface(t *testing.T) {
	var _ vexnor.SqlSelectCommandBuilder = vexnor.NewSqlSelectCommand(makeSelectQuery(), "postgresql")
	var _ vexnor.SqlSelectCommandBuilder = vexnor.NewPostgresSqlSelectCommand(makeSelectQuery())
}


// ─── Registry-level aggregate transform tests ────────────────────────────────

func TestQueryRegistry_PostgresDialect_AppliesBooleanCast(t *testing.T) {
	registry := vexnor.NewQueryRegistry("postgresql")
	query := makeSelectQuery()

	manifest := &vexnor.QueryManifest{
		Version: 1,
		Dialect: "postgresql",
		Queries: map[string]*vexnor.QueryDefinition{
			"abc": query,
		},
	}
	registry.Load(manifest)

	params := map[string]any{
		"select": []any{[]any{"sum", "isActive", "activeCount"}},
	}
	result, err := registry.Build("abc", params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `SELECT sum("a"."is_active"::int) as "activeCount" FROM "account" AS "a"`
	if result.Text != expected {
		t.Errorf("text mismatch:\n  got:  %s\n  want: %s", result.Text, expected)
	}
}

func TestQueryRegistry_MssqlDialect_DoesNotCast(t *testing.T) {
	registry := vexnor.NewQueryRegistry("transactsql")
	query := makeSelectQuery()

	manifest := &vexnor.QueryManifest{
		Version: 1,
		Dialect: "transactsql",
		Queries: map[string]*vexnor.QueryDefinition{
			"abc": query,
		},
	}
	registry.Load(manifest)

	params := map[string]any{
		"select": []any{[]any{"sum", "isActive", "activeCount"}},
	}
	result, err := registry.Build("abc", params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `SELECT sum("a"."is_active") as "activeCount" FROM "account" AS "a"`
	if result.Text != expected {
		t.Errorf("text mismatch:\n  got:  %s\n  want: %s", result.Text, expected)
	}
}

func TestQueryRegistry_SqliteDialect_DoesNotCast(t *testing.T) {
	registry := vexnor.NewQueryRegistry("sqlite")
	query := makeSelectQuery()

	manifest := &vexnor.QueryManifest{
		Version: 1,
		Dialect: "sqlite",
		Queries: map[string]*vexnor.QueryDefinition{
			"abc": query,
		},
	}
	registry.Load(manifest)

	params := map[string]any{
		"select": []any{[]any{"sum", "isActive", "activeCount"}},
	}
	result, err := registry.Build("abc", params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `SELECT sum("a"."is_active") as "activeCount" FROM "account" AS "a"`
	if result.Text != expected {
		t.Errorf("text mismatch:\n  got:  %s\n  want: %s", result.Text, expected)
	}
}
