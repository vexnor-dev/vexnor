package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	vexnor "github.com/vexnor-dev/vexnor/stacks/golang/vexnor"
)

// Executor implements vexnor.Executor for PostgreSQL using pgx.
type Executor struct {
	pool *pgxpool.Pool
}

// New creates a new PostgreSQL Executor from an existing connection pool.
func New(pool *pgxpool.Pool) *Executor {
	return &Executor{pool: pool}
}

// NewFromConnString creates a new PostgreSQL Executor by connecting to the
// given connection string. The caller is responsible for calling Close().
func NewFromConnString(ctx context.Context, connString string) (*Executor, error) {
	pool, err := pgxpool.New(ctx, connString)
	if err != nil {
		return nil, fmt.Errorf("postgres: failed to create pool: %w", err)
	}
	return &Executor{pool: pool}, nil
}

// Close closes the underlying connection pool.
func (e *Executor) Close() {
	e.pool.Close()
}

// QueryRows executes a query and returns all rows as maps.
// Column names are derived from the query's field descriptions.
// UUID values are normalized to their string representation.
func (e *Executor) QueryRows(ctx context.Context, query *vexnor.SqlBuildResult) ([]map[string]any, error) {
	rows, err := e.pool.Query(ctx, query.Text, query.Values...)
	if err != nil {
		return nil, fmt.Errorf("postgres: query failed: %w", err)
	}
	defer rows.Close()

	var results []map[string]any

	for rows.Next() {
		fields := rows.FieldDescriptions()
		values, err := rows.Values()
		if err != nil {
			return nil, fmt.Errorf("postgres: failed to read row values: %w", err)
		}

		row := make(map[string]any, len(fields))
		for i, fd := range fields {
			val := values[i]
			row[fd.Name] = normalizeValue(val)
		}
		results = append(results, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("postgres: row iteration error: %w", err)
	}

	return results, nil
}

// Execute executes a statement and returns the number of affected rows.
func (e *Executor) Execute(ctx context.Context, query *vexnor.SqlBuildResult) (int64, error) {
	tag, err := e.pool.Exec(ctx, query.Text, query.Values...)
	if err != nil {
		return 0, fmt.Errorf("postgres: exec failed: %w", err)
	}
	return tag.RowsAffected(), nil
}

// normalizeValue converts pgx-specific types to standard Go types.
func normalizeValue(val any) any {
	switch v := val.(type) {
	case pgtype.UUID:
		if !v.Valid {
			return nil
		}
		return formatUUID(v.Bytes)
	case [16]byte:
		return formatUUID(v)
	default:
		return val
	}
}

// formatUUID formats a 16-byte UUID as a standard string representation.
func formatUUID(b [16]byte) string {
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// Verify interface compliance at compile time.
var _ vexnor.Executor = (*Executor)(nil)
