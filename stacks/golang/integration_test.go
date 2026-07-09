//go:build integration

package integration_test

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/vexnor-dev/vexnor/stacks/golang/mssql"
	"github.com/vexnor-dev/vexnor/stacks/golang/postgres"
	"github.com/vexnor-dev/vexnor/stacks/golang/sqlite3"
	"github.com/vexnor-dev/vexnor/stacks/golang/vexnor"
)

// fixturesDir returns the path to stacks/fixtures/manifests/
func fixturesDir() string {
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filename), "..", "fixtures", "manifests")
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// ─── PostgreSQL ──────────────────────────────────────────────────────────────

func setupPostgres(t *testing.T) (*vexnor.QueryRegistry, vexnor.Executor) {
	t.Helper()
	registry := vexnor.NewQueryRegistry("postgresql")
	dir := filepath.Join(fixturesDir(), "postgres")
	if err := registry.LoadDirectory(dir, "*.json"); err != nil {
		t.Fatalf("load postgres manifests: %v", err)
	}

	connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
		envOr("POSTGRES_USER", "postgres"),
		envOr("POSTGRES_PASSWORD", "postgres"),
		envOr("POSTGRES_HOST", "localhost"),
		envOr("POSTGRES_PORT", "5432"),
		envOr("POSTGRES_DATABASE", "postgres"),
	)
	executor, err := postgres.NewFromConnString(context.Background(), connStr)
	if err != nil {
		t.Fatalf("connect postgres: %v", err)
	}
	t.Cleanup(func() { executor.Close() })
	return registry, executor
}

func TestPostgres_SelectByStatus(t *testing.T) {
	registry, executor := setupPostgres(t)
	hash := findHash(t, registry, "selectByStatus")

	result, err := registry.Execute(hash, map[string]any{"status": "created"}, map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	rows := result.([]map[string]any)
	if len(rows) == 0 {
		t.Skip("no rows with status=created (empty DB)")
	}
	assertColumns(t, rows[0], "accountId", "status", "email", "firstName", "lastName")
	if rows[0]["status"] != "created" {
		t.Errorf("expected status=created, got %v", rows[0]["status"])
	}
}

func TestPostgres_SelectWithFilter(t *testing.T) {
	registry, executor := setupPostgres(t)
	hash := findHash(t, registry, "selectWithFilter")

	result, err := registry.Execute(hash,
		map[string]any{"filter": map[string]any{"status": "created"}},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	rows := result.([]map[string]any)
	for _, row := range rows {
		if row["status"] != "created" {
			t.Errorf("filter not applied: got status=%v", row["status"])
		}
	}
}

func TestPostgres_SelectOrdered(t *testing.T) {
	registry, executor := setupPostgres(t)
	hash := findHash(t, registry, "selectOrdered")

	result, err := registry.Execute(hash,
		map[string]any{"orderBy": map[string]any{"email": "ASC"}},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	rows := result.([]map[string]any)
	if len(rows) < 2 {
		t.Skip("need at least 2 rows to verify ordering")
	}
	// Verify ascending order
	for i := 1; i < len(rows); i++ {
		prev := fmt.Sprintf("%v", rows[i-1]["email"])
		curr := fmt.Sprintf("%v", rows[i]["email"])
		if prev > curr {
			t.Errorf("not ascending: rows[%d].email=%s > rows[%d].email=%s", i-1, prev, i, curr)
			break
		}
	}
}

func TestPostgres_InsertAndDelete(t *testing.T) {
	registry, executor := setupPostgres(t)
	insertHash := findHash(t, registry, "insertAccounts")
	deleteHash := findHash(t, registry, "deleteAccount")

	// Insert
	email := fmt.Sprintf("go-e2e-%d@test.com", os.Getpid())
	result, err := registry.Execute(insertHash,
		map[string]any{"rows": []any{map[string]any{"email": email, "firstName": "Go", "lastName": "E2E"}}},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("insert: %v", err)
	}

	rows := result.([]map[string]any)
	if len(rows) != 1 {
		t.Fatalf("expected 1 inserted row, got %d", len(rows))
	}
	accountId := rows[0]["accountId"]
	if accountId == nil || accountId == "" {
		t.Fatal("inserted row missing accountId")
	}
	assertColumns(t, rows[0], "accountId", "email", "firstName", "lastName", "status", "createdAt")
	if rows[0]["email"] != email {
		t.Errorf("email mismatch: got %v", rows[0]["email"])
	}

	// Delete
	_, err = registry.Execute(deleteHash,
		map[string]any{"accountId": accountId},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("delete: %v", err)
	}
}

func TestPostgres_UpdateAccount(t *testing.T) {
	registry, executor := setupPostgres(t)
	insertHash := findHash(t, registry, "insertAccounts")
	updateHash := findHash(t, registry, "updateAccount")
	deleteHash := findHash(t, registry, "deleteAccount")

	// Insert
	email := fmt.Sprintf("go-update-%d@test.com", os.Getpid())
	result, _ := registry.Execute(insertHash,
		map[string]any{"rows": []any{map[string]any{"email": email, "firstName": "Before", "lastName": "Update"}}},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	rows := result.([]map[string]any)
	accountId := rows[0]["accountId"]

	// Update
	result, err := registry.Execute(updateHash,
		map[string]any{"set": map[string]any{"firstName": "After"}, "accountId": accountId},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	updated := result.([]map[string]any)
	if len(updated) != 1 {
		t.Fatalf("expected 1 updated row, got %d", len(updated))
	}
	if updated[0]["firstName"] != "After" {
		t.Errorf("update not applied: firstName=%v", updated[0]["firstName"])
	}

	// Cleanup
	registry.Execute(deleteHash, map[string]any{"accountId": accountId}, map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
}

func TestPostgres_SelectMyOrders_ContextInjection(t *testing.T) {
	registry, executor := setupPostgres(t)
	hash := findHash(t, registry, "selectMyOrders")

	// Without context — should fail
	_, err := registry.Execute(hash, map[string]any{}, map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err == nil {
		t.Fatal("expected error when userId context missing")
	}

	// With context — should succeed
	result, err := registry.Execute(hash, map[string]any{}, map[string]any{"userId": "00000000-0000-0000-0000-000000000000"},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("execute with context: %v", err)
	}
	// Result should be a slice (possibly empty if no orders for this user)
	_ = result.([]map[string]any)
}

func TestPostgres_SelectConditional(t *testing.T) {
	registry, executor := setupPostgres(t)
	hash := findHash(t, registry, "selectConditional")

	// With hasEmail=true
	result, err := registry.Execute(hash,
		map[string]any{"status": "created", "hasEmail": true, "email": "nonexistent@test.com"},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	rows := result.([]map[string]any)
	// Should return 0 rows (nonexistent email)
	if len(rows) != 0 {
		t.Errorf("expected 0 rows for nonexistent email, got %d", len(rows))
	}

	// With hasEmail=false — broader results
	result2, err := registry.Execute(hash,
		map[string]any{"status": "created", "hasEmail": false, "email": ""},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	rows2 := result2.([]map[string]any)
	// Without email filter, should get more results (or at least not error)
	_ = rows2
}

func TestPostgres_Pagination(t *testing.T) {
	registry, executor := setupPostgres(t)
	hash := findHash(t, registry, "selectByStatus")

	// Use selectByStatus which returns all with a given status, add limit via CRUD
	// Actually use selectAccountsCrud which has pagination
	crudHash := findHash(t, registry, "selectAccountsCrud")
	if crudHash == "" {
		t.Skip("selectAccountsCrud not in manifest")
	}

	result, err := registry.Execute(crudHash,
		map[string]any{"limit": 2, "offset": 0},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	rows := result.([]map[string]any)
	if len(rows) > 2 {
		t.Errorf("pagination not applied: got %d rows, expected <= 2", len(rows))
	}
	_ = hash
}

// ─── MSSQL ───────────────────────────────────────────────────────────────────

func setupMssql(t *testing.T) (*vexnor.QueryRegistry, vexnor.Executor) {
	t.Helper()
	registry := vexnor.NewQueryRegistry("transactsql")
	dir := filepath.Join(fixturesDir(), "mssql")
	if err := registry.LoadDirectory(dir, "*.json"); err != nil {
		t.Fatalf("load mssql manifests: %v", err)
	}

	connStr := fmt.Sprintf("sqlserver://%s:%s@%s:%s?database=%s&encrypt=disable",
		envOr("MSSQL_USER", "vexnor_dev"),
		envOr("MSSQL_PASSWORD", "P@ssw0rd!"),
		envOr("MSSQL_HOST", "localhost"),
		envOr("MSSQL_PORT", "1433"),
		envOr("MSSQL_DATABASE", "vexnor"),
	)
	executor, err := mssql.NewFromConnString(connStr)
	if err != nil {
		t.Fatalf("connect mssql: %v", err)
	}
	t.Cleanup(func() { executor.Close() })
	return registry, executor
}

func TestMssql_SelectByStatus(t *testing.T) {
	registry, executor := setupMssql(t)
	hash := findHash(t, registry, "selectByStatus")

	result, err := registry.Execute(hash, map[string]any{"status": "created"}, map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	rows := result.([]map[string]any)
	if len(rows) == 0 {
		t.Skip("no rows (empty DB)")
	}
	assertColumns(t, rows[0], "accountId", "status", "email", "firstName", "lastName")
}

func TestMssql_InsertAndSelect(t *testing.T) {
	registry, executor := setupMssql(t)
	insertHash := findHash(t, registry, "insertAccounts")

	email := fmt.Sprintf("go-mssql-e2e-%d@test.com", os.Getpid())
	result, err := registry.Execute(insertHash,
		map[string]any{"rows": []any{map[string]any{"email": email, "firstName": "Go", "lastName": "MssqlE2E"}}},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("insert: %v", err)
	}
	rows := result.([]map[string]any)
	if len(rows) != 1 {
		t.Fatalf("expected 1 inserted row, got %d", len(rows))
	}
	assertColumns(t, rows[0], "accountId", "email", "firstName", "lastName", "status")
}

func TestMssql_SelectWithFilter(t *testing.T) {
	registry, executor := setupMssql(t)
	hash := findHash(t, registry, "selectWithFilter")

	result, err := registry.Execute(hash,
		map[string]any{"filter": map[string]any{"status": "created"}},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	rows := result.([]map[string]any)
	for _, row := range rows {
		status := fmt.Sprintf("%v", row["status"])
		if !strings.EqualFold(status, "created") {
			t.Errorf("filter not applied: got status=%v", row["status"])
		}
	}
}

// ─── SQLite3 ─────────────────────────────────────────────────────────────────

func setupSqlite3(t *testing.T) (*vexnor.QueryRegistry, vexnor.Executor) {
	t.Helper()
	registry := vexnor.NewQueryRegistry("sqlite")
	dir := filepath.Join(fixturesDir(), "sqlite3")
	if err := registry.LoadDirectory(dir, "*.json"); err != nil {
		t.Fatalf("load sqlite3 manifests: %v", err)
	}

	dbPath := envOr("SQLITE_PATH", filepath.Join(fixturesDir(), "..", "..", "@db-sqlite3", "vexnor-dev.sqlite"))
	if _, err := os.Stat(dbPath); err != nil {
		// Try relative to repo root
		_, thisFile, _, _ := runtime.Caller(0)
		dbPath = filepath.Join(filepath.Dir(thisFile), "..", "..", "@db-sqlite3", "vexnor-dev.sqlite")
	}
	executor, err := sqlite3.NewFromPath(dbPath)
	if err != nil {
		t.Fatalf("open sqlite3: %v", err)
	}
	t.Cleanup(func() { executor.Close() })
	return registry, executor
}

func TestSqlite3_SelectByStatus(t *testing.T) {
	registry, executor := setupSqlite3(t)
	hash := findHash(t, registry, "selectByStatus")

	result, err := registry.Execute(hash, map[string]any{"status": "created"}, map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	rows := result.([]map[string]any)
	if len(rows) == 0 {
		t.Skip("no rows (empty DB)")
	}
	assertColumns(t, rows[0], "accountId", "status", "email", "firstName", "lastName")
}

func TestSqlite3_InsertAndSelect(t *testing.T) {
	registry, executor := setupSqlite3(t)
	insertHash := findHash(t, registry, "insertAccounts")

	email := fmt.Sprintf("go-sqlite-e2e-%d@test.com", os.Getpid())
	result, err := registry.Execute(insertHash,
		map[string]any{"rows": []any{map[string]any{"email": email, "firstName": "Go", "lastName": "SqliteE2E"}}},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("insert: %v", err)
	}
	rows := result.([]map[string]any)
	if len(rows) != 1 {
		t.Fatalf("expected 1 inserted row, got %d", len(rows))
	}
	assertColumns(t, rows[0], "accountId", "email", "firstName", "lastName")
}

func TestSqlite3_SelectWithFilter(t *testing.T) {
	registry, executor := setupSqlite3(t)
	hash := findHash(t, registry, "selectWithFilter")

	result, err := registry.Execute(hash,
		map[string]any{"filter": map[string]any{"status": "created"}},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	rows := result.([]map[string]any)
	for _, row := range rows {
		if row["status"] != "created" {
			t.Errorf("filter not applied: got status=%v", row["status"])
		}
	}
}

func TestSqlite3_UpdateAccount(t *testing.T) {
	registry, executor := setupSqlite3(t)
	insertHash := findHash(t, registry, "insertAccounts")
	updateHash := findHash(t, registry, "updateAccount")

	email := fmt.Sprintf("go-sqlite-upd-%d@test.com", os.Getpid())
	result, _ := registry.Execute(insertHash,
		map[string]any{"rows": []any{map[string]any{"email": email, "firstName": "Before", "lastName": "Upd"}}},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	rows := result.([]map[string]any)
	accountId := rows[0]["accountId"]

	// Update
	result2, err := registry.Execute(updateHash,
		map[string]any{"set": map[string]any{"firstName": "After"}, "accountId": accountId},
		map[string]any{},
		func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(context.Background(), sql)
		})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	updated := result2.([]map[string]any)
	if len(updated) != 1 {
		t.Fatalf("expected 1 updated row, got %d", len(updated))
	}
	if updated[0]["firstName"] != "After" {
		t.Errorf("update not applied: firstName=%v", updated[0]["firstName"])
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func findHash(t *testing.T, registry *vexnor.QueryRegistry, name string) string {
	t.Helper()
	for _, q := range registry.GetRegisteredQueries() {
		if q.Name == name {
			return q.Hash
		}
	}
	t.Fatalf("query %q not found in registry", name)
	return ""
}

func assertColumns(t *testing.T, row map[string]any, cols ...string) {
	t.Helper()
	for _, col := range cols {
		if _, ok := row[col]; !ok {
			t.Errorf("missing column %q in result row. Got keys: %v", col, mapKeys(row))
		}
	}
}

func mapKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
