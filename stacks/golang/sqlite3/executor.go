package sqlite3

import (
	"context"
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"

	vexnor "github.com/vexnor-dev/vexnor-go/vexnor"
)

// Executor implements vexnor.Executor for SQLite3 using modernc.org/sqlite.
type Executor struct {
	db *sql.DB
}

// New creates a new SQLite3 Executor from an existing *sql.DB connection.
func New(db *sql.DB) *Executor {
	return &Executor{db: db}
}

// NewFromPath creates a new SQLite3 Executor by opening the database file
// at the given path. The caller is responsible for calling Close().
func NewFromPath(path string) (*Executor, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("sqlite3: failed to open database: %w", err)
	}
	return &Executor{db: db}, nil
}

// Close closes the underlying database connection.
func (e *Executor) Close() error {
	return e.db.Close()
}

// QueryRows executes a query and returns all rows as maps.
// SQLite uses ? positional parameters — values are passed directly.
func (e *Executor) QueryRows(ctx context.Context, query *vexnor.SqlBuildResult) ([]map[string]any, error) {
	rows, err := e.db.QueryContext(ctx, query.Text, query.Values...)
	if err != nil {
		return nil, fmt.Errorf("sqlite3: query failed: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("sqlite3: failed to get columns: %w", err)
	}

	var results []map[string]any

	for rows.Next() {
		scanDest := make([]any, len(columns))
		scanPtrs := make([]any, len(columns))
		for i := range scanDest {
			scanPtrs[i] = &scanDest[i]
		}

		if err := rows.Scan(scanPtrs...); err != nil {
			return nil, fmt.Errorf("sqlite3: failed to scan row: %w", err)
		}

		row := make(map[string]any, len(columns))
		for i, colName := range columns {
			row[colName] = normalizeValue(scanDest[i])
		}
		results = append(results, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("sqlite3: row iteration error: %w", err)
	}

	return results, nil
}

// Execute executes a statement and returns the number of affected rows.
func (e *Executor) Execute(ctx context.Context, query *vexnor.SqlBuildResult) (int64, error) {
	result, err := e.db.ExecContext(ctx, query.Text, query.Values...)
	if err != nil {
		return 0, fmt.Errorf("sqlite3: exec failed: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("sqlite3: failed to get rows affected: %w", err)
	}

	return affected, nil
}

// normalizeValue converts database-specific types to standard Go types.
// SQLite stores values as TEXT, INTEGER, REAL, BLOB, or NULL — no UUID
// coercion is needed since UUIDs are stored as plain strings.
func normalizeValue(val any) any {
	switch v := val.(type) {
	case []byte:
		return string(v)
	default:
		return val
	}
}

// Verify interface compliance at compile time.
var _ vexnor.Executor = (*Executor)(nil)
