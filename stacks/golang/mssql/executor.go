package mssql

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/microsoft/go-mssqldb"

	vexnor "github.com/vexnor-dev/vexnor/stacks/golang/vexnor"
)

// Executor implements vexnor.Executor for MS SQL Server.
type Executor struct {
	db *sql.DB
}

// New creates a new MSSQL Executor from an existing *sql.DB connection.
func New(db *sql.DB) *Executor {
	return &Executor{db: db}
}

// NewFromConnString creates a new MSSQL Executor by opening a connection
// to the given connection string. The caller is responsible for calling Close().
func NewFromConnString(connString string) (*Executor, error) {
	db, err := sql.Open("sqlserver", connString)
	if err != nil {
		return nil, fmt.Errorf("mssql: failed to open connection: %w", err)
	}
	return &Executor{db: db}, nil
}

// Close closes the underlying database connection.
func (e *Executor) Close() error {
	return e.db.Close()
}

// QueryRows executes a query and returns all rows as maps.
// Parameters are passed as sql.Named("param_0", val), etc. to match
// the @param_0, @param_1 placeholders used by the SQL builder.
func (e *Executor) QueryRows(ctx context.Context, query *vexnor.SqlBuildResult) ([]map[string]any, error) {
	args := makeNamedArgs(query.Values)

	rows, err := e.db.QueryContext(ctx, query.Text, args...)
	if err != nil {
		return nil, fmt.Errorf("mssql: query failed: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("mssql: failed to get columns: %w", err)
	}

	var results []map[string]any

	for rows.Next() {
		scanDest := make([]any, len(columns))
		scanPtrs := make([]any, len(columns))
		for i := range scanDest {
			scanPtrs[i] = &scanDest[i]
		}

		if err := rows.Scan(scanPtrs...); err != nil {
			return nil, fmt.Errorf("mssql: failed to scan row: %w", err)
		}

		row := make(map[string]any, len(columns))
		for i, colName := range columns {
			row[colName] = normalizeValue(scanDest[i])
		}
		results = append(results, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("mssql: row iteration error: %w", err)
	}

	return results, nil
}

// Execute executes a statement and returns the number of affected rows.
func (e *Executor) Execute(ctx context.Context, query *vexnor.SqlBuildResult) (int64, error) {
	args := makeNamedArgs(query.Values)

	result, err := e.db.ExecContext(ctx, query.Text, args...)
	if err != nil {
		return 0, fmt.Errorf("mssql: exec failed: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("mssql: failed to get rows affected: %w", err)
	}

	return affected, nil
}

// makeNamedArgs converts a slice of values into sql.Named arguments
// matching the @param_0, @param_1, ... placeholders.
func makeNamedArgs(values []any) []any {
	args := make([]any, len(values))
	for i, val := range values {
		args[i] = sql.Named(fmt.Sprintf("param_%d", i), val)
	}
	return args
}

// normalizeValue converts database-specific types to standard Go types.
func normalizeValue(val any) any {
	switch v := val.(type) {
	case []byte:
		// MSSQL returns uniqueidentifier as []byte (16 bytes).
		if len(v) == 16 {
			return formatMSSQLUUID(v)
		}
		return string(v)
	default:
		return val
	}
}

// formatMSSQLUUID formats a 16-byte MSSQL uniqueidentifier to a string.
// MSSQL stores UUIDs with mixed-endian byte order for the first three groups.
func formatMSSQLUUID(b []byte) string {
	return fmt.Sprintf("%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
		b[3], b[2], b[1], b[0],
		b[5], b[4],
		b[7], b[6],
		b[8], b[9],
		b[10], b[11], b[12], b[13], b[14], b[15])
}

// Verify interface compliance at compile time.
var _ vexnor.Executor = (*Executor)(nil)
