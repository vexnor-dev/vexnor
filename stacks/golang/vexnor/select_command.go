package vexnor

// SqlSelectCommand is a higher-level abstraction that wraps SqlBuilder for SELECT queries.
// It provides a TransformAggregateColumn hook that per-database subclasses can override
// to inject dialect-specific behavior (e.g., type casts inside aggregates).
//
// This mirrors the .NET Vexnor.Core.Execution.SqlSelectCommand pattern.
type SqlSelectCommand struct {
	query   *QueryDefinition
	dialect string
}

// NewSqlSelectCommand creates a new SqlSelectCommand for the given query and dialect.
func NewSqlSelectCommand(query *QueryDefinition, dialect string) *SqlSelectCommand {
	return &SqlSelectCommand{query: query, dialect: dialect}
}

// Build builds the SQL text and parameter values for the SELECT query.
// Passes TransformAggregateColumn into the builder so that subclasses can
// inject dialect-specific aggregate column transformations.
func (c *SqlSelectCommand) Build(params map[string]any) (*SqlBuildResult, error) {
	builder := NewSqlBuilder(c.dialect)
	return builder.BuildWithTransform(c.query, params, c.TransformAggregateColumn)
}

// TransformAggregateColumn is the base implementation that returns the column SQL unchanged.
// Override this method in a subclass to inject dialect-specific behavior.
func (c *SqlSelectCommand) TransformAggregateColumn(fn, colSql string, colType *string) string {
	return colSql
}

// SqlSelectCommandBuilder is the interface that all select command implementations satisfy.
// This allows dialect-specific implementations to provide their own TransformAggregateColumn.
type SqlSelectCommandBuilder interface {
	Build(params map[string]any) (*SqlBuildResult, error)
}

// PostgresSqlSelectCommand is a PostgreSQL-specific SELECT command.
// It appends ::int cast to boolean columns inside SUM/AVG aggregates,
// since PostgreSQL does not natively support SUM/AVG on boolean.
//
// This mirrors the .NET Vexnor.Postgres.PostgresSqlSelectCommand pattern.
type PostgresSqlSelectCommand struct {
	query   *QueryDefinition
	dialect string
}

// NewPostgresSqlSelectCommand creates a PostgreSQL-specific select command.
func NewPostgresSqlSelectCommand(query *QueryDefinition) *PostgresSqlSelectCommand {
	return &PostgresSqlSelectCommand{query: query, dialect: "postgresql"}
}

// Build builds the SQL using the PostgreSQL-specific aggregate transform.
func (c *PostgresSqlSelectCommand) Build(params map[string]any) (*SqlBuildResult, error) {
	builder := NewSqlBuilder(c.dialect)
	return builder.BuildWithTransform(c.query, params, c.TransformAggregateColumn)
}

// TransformAggregateColumn appends ::int cast to boolean columns inside SUM/AVG.
func (c *PostgresSqlSelectCommand) TransformAggregateColumn(fn, colSql string, colType *string) string {
	if (fn == "sum" || fn == "avg") && colType != nil && *colType == "boolean" {
		return colSql + "::int"
	}
	return colSql
}
