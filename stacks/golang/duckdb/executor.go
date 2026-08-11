package duckdb

import (
	"context"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"time"

	duckdbdriver "github.com/duckdb/duckdb-go/v2"

	vexnor "github.com/vexnor-dev/vexnor/stacks/golang/vexnor"
)

// Executor implements vexnor.Executor using DuckDB's database/sql driver.
type Executor struct {
	db *sql.DB
}

// New wraps an existing database/sql pool.
func New(db *sql.DB) *Executor {
	return &Executor{db: db}
}

// NewMemory opens an isolated in-memory DuckDB database.
func NewMemory() (*Executor, error) {
	return newExecutor(":memory:")
}

// NewFromPath opens or creates a file-backed DuckDB database.
func NewFromPath(path string) (*Executor, error) {
	if path == "" {
		return nil, fmt.Errorf("duckdb: path must not be empty")
	}
	return newExecutor(path)
}

func newExecutor(path string) (*Executor, error) {
	db, err := sql.Open("duckdb", path)
	if err != nil {
		return nil, fmt.Errorf("duckdb: failed to open database: %w", err)
	}
	if path == ":memory:" {
		db.SetMaxOpenConns(1)
	}
	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("duckdb: failed to initialize database: %w", err)
	}
	return &Executor{db: db}, nil
}

// Close closes the underlying database/sql pool.
func (e *Executor) Close() error {
	return e.db.Close()
}

// QueryRows executes a query and normalizes each row to JSON-compatible values.
func (e *Executor) QueryRows(ctx context.Context, query *vexnor.SqlBuildResult) ([]map[string]any, error) {
	rows, err := e.db.QueryContext(ctx, query.Text, query.Values...)
	if err != nil {
		return nil, fmt.Errorf("duckdb: query failed: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("duckdb: failed to get columns: %w", err)
	}
	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, fmt.Errorf("duckdb: failed to get column types: %w", err)
	}
	results := make([]map[string]any, 0)
	for rows.Next() {
		values := make([]any, len(columns))
		destinations := make([]any, len(columns))
		for index := range values {
			destinations[index] = &values[index]
		}
		if err := rows.Scan(destinations...); err != nil {
			return nil, fmt.Errorf("duckdb: failed to scan row: %w", err)
		}
		row := make(map[string]any, len(columns))
		for index, name := range columns {
			row[name] = normalizeValue(values[index], columnTypes[index].DatabaseTypeName())
		}
		results = append(results, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("duckdb: row iteration failed: %w", err)
	}
	return results, nil
}

// Execute executes a statement and returns its affected row count.
func (e *Executor) Execute(ctx context.Context, query *vexnor.SqlBuildResult) (int64, error) {
	result, err := e.db.ExecContext(ctx, query.Text, query.Values...)
	if err != nil {
		return 0, fmt.Errorf("duckdb: exec failed: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("duckdb: failed to get rows affected: %w", err)
	}
	return affected, nil
}

func normalizeValue(value any, databaseType string) any {
	switch current := value.(type) {
	case nil:
		return nil
	case time.Time:
		return current.UTC().Format(time.RFC3339Nano)
	case duckdbdriver.Decimal:
		return current.String()
	case *big.Int:
		return current.String()
	case *big.Float:
		return current.Text('f', -1)
	case []byte:
		if strings.EqualFold(databaseType, "UUID") && len(current) == 16 {
			encoded := hex.EncodeToString(current)
			return encoded[0:8] + "-" + encoded[8:12] + "-" + encoded[12:16] + "-" + encoded[16:20] + "-" + encoded[20:32]
		}
		return current
	case []any:
		result := make([]any, len(current))
		for index, item := range current {
			result[index] = normalizeValue(item, "")
		}
		return result
	case map[string]any:
		if strings.EqualFold(databaseType, "JSON") {
			encoded, err := json.Marshal(current)
			if err == nil {
				return string(encoded)
			}
		}
		result := make(map[string]any, len(current))
		for key, item := range current {
			result[key] = normalizeValue(item, "")
		}
		return result
	default:
		return value
	}
}

var _ vexnor.Executor = (*Executor)(nil)
