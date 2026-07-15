package vexnor

import "context"

// Executor executes SQL queries against a database.
type Executor interface {
	// QueryRows executes a query and returns all rows as maps.
	QueryRows(ctx context.Context, query *SqlBuildResult) ([]map[string]any, error)
	// Execute executes a statement and returns affected row count.
	Execute(ctx context.Context, query *SqlBuildResult) (int64, error)
}
