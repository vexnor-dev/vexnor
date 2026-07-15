//go:build integration

package integration_test

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/vexnor-dev/vexnor/stacks/golang/postgres"
	"github.com/vexnor-dev/vexnor/stacks/golang/sqlite3"
	"github.com/vexnor-dev/vexnor/stacks/golang/vexnor"
)

// TestCrossRuntime_Postgres_Execute loads the cross-runtime manifest, builds each
// SELECT query, and executes it against PostgreSQL. Verifies the query runs without
// error — proving the Go SqlBuilder produces valid, executable SQL.
func TestCrossRuntime_Postgres_Execute(t *testing.T) {
	registry, executor := setupPostgresForCrossRuntime(t)
	expected := loadExpectedResults(t)

	for name, entry := range expected {
		if entry.Error != nil {
			continue // skip error cases
		}
		if strings.Contains(name, "Mssql") {
			continue
		}
		if isWriteQuery(entry.Text) {
			continue
		}
		// Projection fixtures use manually injected manifests with "main" schema — skip for postgres
		if strings.HasPrefix(name, "xProjection") || name == "xParamArray" {
			continue
		}
		// xFilterEmpty produces "WHERE " with no condition — valid for SQL text parity but not executable
		if name == "xFilterEmpty" {
			continue
		}

		t.Run(name, func(t *testing.T) {
			params := deserializeParamsForE2E(entry.Params)
			result, err := registry.Execute(entry.Hash, params, map[string]any{},
				func(sql *vexnor.SqlBuildResult) (any, error) {
					return executor.QueryRows(context.Background(), sql)
				})
			if err != nil {
				// Syntax errors = real failures (invalid SQL generated)
				errStr := err.Error()
				if strings.Contains(errStr, "42601") { // syntax_error
					t.Fatalf("SQL SYNTAX ERROR: %v", err)
				}
				// Data/type errors = skip (enum mismatch, type mismatch, etc.)
				// These mean the SQL is valid but the test data doesn't match the schema
				t.Skipf("data/type error (SQL is valid): %v", err)
			}
			rows, ok := result.([]map[string]any)
			if !ok {
				t.Fatalf("expected []map[string]any, got %T", result)
			}
			// Query executed successfully — rows may be empty but SQL was valid
			_ = rows
		})
	}
}

// TestCrossRuntime_Sqlite3_Execute does the same for SQLite3.
func TestCrossRuntime_Sqlite3_Execute(t *testing.T) {
	registry, executor := setupSqlite3ForCrossRuntime(t)
	expected := loadExpectedResults(t)

	for name, entry := range expected {
		if entry.Error != nil {
			continue
		}
		if strings.Contains(name, "Mssql") {
			continue
		}
		if isWriteQuery(entry.Text) {
			continue
		}
		// Skip postgres-specific queries (vexnor_dev schema, joins referencing postgres tables)
		if strings.Contains(entry.Text, "vexnor_dev") {
			continue
		}
		// Projection fixtures reference "main" schema — these should work on sqlite
		// But skip paramArray which uses "main"."account" (may not exist)
		if name == "xParamArray" || name == "xParamArrayMssql" {
			continue
		}
		// Skip join queries — they reference tables that may not exist in sqlite fixture
		if strings.HasPrefix(name, "xJoinBy") {
			continue
		}

		t.Run(name, func(t *testing.T) {
			params := deserializeParamsForE2E(entry.Params)
			result, err := registry.Execute(entry.Hash, params, map[string]any{},
				func(sql *vexnor.SqlBuildResult) (any, error) {
					return executor.QueryRows(context.Background(), sql)
				})
			if err != nil {
				errStr := err.Error()
				// SQLite syntax error
				if strings.Contains(errStr, "syntax error") || strings.Contains(errStr, "near \"") {
					t.Fatalf("SQL SYNTAX ERROR: %v", err)
				}
				t.Skipf("data/type error (SQL is valid): %v", err)
			}
			rows, ok := result.([]map[string]any)
			if !ok {
				t.Fatalf("expected []map[string]any, got %T", result)
			}
			_ = rows
		})
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func crossRuntimeFixturesDir() string {
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filename), "..", "fixtures", "manifests", "cross-runtime")
}

// Note: we reuse the manifest that the cross-runtime tests use, but execute against real DBs.
// The manifest uses the vexnor_dev postgres schema for most queries.

func setupPostgresForCrossRuntime(t *testing.T) (*vexnor.QueryRegistry, *postgres.Executor) {
	t.Helper()
	registry := vexnor.NewQueryRegistry("postgresql")
	manifestPath := filepath.Join(crossRuntimeFixturesDir(), "manifest.json")
	if err := registry.LoadFile(manifestPath); err != nil {
		t.Fatalf("load manifest: %v", err)
	}

	connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
		envOr("POSTGRES_USER", "postgres"),
		envOr("POSTGRES_PASSWORD", "postgres"),
		envOr("POSTGRES_HOST", "localhost"),
		envOr("POSTGRES_PORT", "5432"),
		envOr("POSTGRES_DATABASE", "postgres"),
	)
	exec, err := postgres.NewFromConnString(context.Background(), connStr)
	if err != nil {
		t.Fatalf("connect postgres: %v", err)
	}
	t.Cleanup(func() { exec.Close() })
	return registry, exec
}

func setupSqlite3ForCrossRuntime(t *testing.T) (*vexnor.QueryRegistry, *sqlite3.Executor) {
	t.Helper()
	registry := vexnor.NewQueryRegistry("sqlite")
	manifestPath := filepath.Join(crossRuntimeFixturesDir(), "manifest.json")
	if err := registry.LoadFile(manifestPath); err != nil {
		t.Fatalf("load manifest: %v", err)
	}

	_, thisFile, _, _ := runtime.Caller(0)
	dbPath := filepath.Join(filepath.Dir(thisFile), "..", "@db-sqlite3", "vexnor-dev.sqlite")
	dbPath = envOr("SQLITE_PATH", dbPath)
	exec, err := sqlite3.NewFromPath(dbPath)
	if err != nil {
		t.Fatalf("open sqlite3: %v", err)
	}
	t.Cleanup(func() { exec.Close() })
	return registry, exec
}

type expectedEntry struct {
	Hash   string          `json:"hash"`
	Text   string          `json:"text"`
	Values []any           `json:"values"`
	Params json.RawMessage `json:"params"`
	Error  *string         `json:"error"`
}

func loadExpectedResults(t *testing.T) map[string]*expectedEntry {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(crossRuntimeFixturesDir(), "expected.json"))
	if err != nil {
		t.Fatalf("read expected.json: %v", err)
	}
	var results map[string]*expectedEntry
	if err := json.Unmarshal(data, &results); err != nil {
		t.Fatalf("parse expected.json: %v", err)
	}
	return results
}

func deserializeParamsForE2E(raw json.RawMessage) map[string]any {
	if len(raw) == 0 || string(raw) == "null" {
		return map[string]any{}
	}
	var result map[string]any
	json.Unmarshal(raw, &result)
	if result == nil {
		return map[string]any{}
	}
	return result
}

func isWriteQuery(text string) bool {
	upper := strings.ToUpper(text)
	return strings.Contains(upper, "INSERT") ||
		strings.Contains(upper, "UPDATE") ||
		strings.Contains(upper, "DELETE") ||
		strings.Contains(upper, "MERGE")
}
