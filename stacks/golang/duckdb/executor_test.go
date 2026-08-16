package duckdb

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/vexnor-dev/vexnor/stacks/golang/vexnor"
)

func TestExecutorParameterizedReadWrite(t *testing.T) {
	executor, err := NewFromPath(filepath.Join(t.TempDir(), "integration.duckdb"))
	if err != nil {
		t.Fatalf("open DuckDB: %v", err)
	}
	t.Cleanup(func() {
		if err := executor.Close(); err != nil {
			t.Errorf("close DuckDB: %v", err)
		}
	})

	ctx := context.Background()
	if _, err := executor.Execute(ctx, &vexnor.SqlBuildResult{
		Text: "CREATE TABLE account (account_id INTEGER PRIMARY KEY, email VARCHAR NOT NULL)",
	}); err != nil {
		t.Fatalf("create table: %v", err)
	}
	if _, err := executor.Execute(ctx, &vexnor.SqlBuildResult{
		Text:   "INSERT INTO account VALUES ($1, $2)",
		Values: []any{42, "duck@example.com"},
	}); err != nil {
		t.Fatalf("insert: %v", err)
	}

	rows, err := executor.QueryRows(ctx, &vexnor.SqlBuildResult{
		Text:   `SELECT account_id AS "accountId", email FROM account WHERE account_id = $1`,
		Values: []any{42},
	})
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("rows = %d, want 1", len(rows))
	}
	if rows[0]["accountId"] != int32(42) && rows[0]["accountId"] != int64(42) {
		t.Fatalf("accountId = %#v", rows[0]["accountId"])
	}
	if rows[0]["email"] != "duck@example.com" {
		t.Fatalf("email = %#v", rows[0]["email"])
	}
}

func TestExecutorMemoryAndCancellation(t *testing.T) {
	executor, err := NewMemory()
	if err != nil {
		t.Fatalf("open in-memory DuckDB: %v", err)
	}
	t.Cleanup(func() { _ = executor.Close() })
	if _, err := executor.Execute(context.Background(), &vexnor.SqlBuildResult{Text: "CREATE TABLE memory_state (id INTEGER)"}); err != nil {
		t.Fatalf("create in-memory table: %v", err)
	}
	rows, err := executor.QueryRows(context.Background(), &vexnor.SqlBuildResult{Text: "SELECT COUNT(*) AS count FROM memory_state"})
	if err != nil {
		t.Fatalf("read in-memory table: %v", err)
	}
	if len(rows) != 1 || rows[0]["count"] != int64(0) {
		t.Fatalf("in-memory rows = %#v", rows)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = executor.QueryRows(ctx, &vexnor.SqlBuildResult{Text: "SELECT 1"})
	if err == nil {
		t.Fatal("expected cancellation error")
	}
}

func TestExecutorNormalizesDuckDBNativeValues(t *testing.T) {
	executor, err := NewMemory()
	if err != nil {
		t.Fatalf("open in-memory DuckDB: %v", err)
	}
	t.Cleanup(func() { _ = executor.Close() })

	rows, err := executor.QueryRows(context.Background(), &vexnor.SqlBuildResult{Text: `
		SELECT
			'00000000-0000-4000-8000-000000000001'::UUID AS uuid,
			123.45::DECIMAL(10,2) AS decimal,
			123456789012345678901234567890::HUGEINT AS hugeint,
			DATE '2026-08-10' AS date,
			TIMESTAMP '2026-08-10 12:34:56.789' AS timestamp,
			[1, 2]::INTEGER[] AS list,
			{'answer': 42}::STRUCT(answer INTEGER) AS struct,
			MAP {'one': 1} AS map,
			'abc'::BLOB AS blob,
			'{"answer":42}'::JSON AS json
	`})
	if err != nil {
		t.Fatalf("query native values: %v", err)
	}
	encoded, err := json.Marshal(rows)
	if err != nil {
		t.Fatalf("marshal normalized rows: %v", err)
	}
	const expected = `[{"blob":"YWJj","date":"2026-08-10T00:00:00Z","decimal":"123.45","hugeint":"123456789012345678901234567890","json":"{\"answer\":42}","list":[1,2],"map":{"one":1},"struct":{"answer":42},"timestamp":"2026-08-10T12:34:56.789Z","uuid":"00000000-0000-4000-8000-000000000001"}]`
	if string(encoded) != expected {
		t.Fatalf("normalized rows\nwant: %s\n got: %s", expected, encoded)
	}
}
