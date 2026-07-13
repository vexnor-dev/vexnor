using Vexnor.Core.Manifest;

namespace Vexnor.Core.Execution;

/// <summary>
/// Higher-level abstraction that wraps SqlBuilder for SELECT queries.
/// Provides virtual methods that per-database subclasses can override to inject
/// dialect-specific behavior (e.g., type casts inside aggregates).
/// </summary>
public class SqlSelectCommand
{
    protected readonly SqlBuilder _builder;
    protected readonly QueryDefinition _query;
    protected readonly string _dialect;

    public SqlSelectCommand(QueryDefinition query, string dialect)
    {
        _query = query;
        _dialect = dialect;
        _builder = new SqlBuilder(dialect);
    }

    /// <summary>
    /// Builds the SQL text and parameter values for the SELECT query.
    /// Passes <see cref="TransformAggregateColumn"/> into the builder so that
    /// subclasses can inject dialect-specific aggregate column transformations.
    /// </summary>
    public virtual SqlBuildResult Build(Dictionary<string, object?> parameters)
    {
        return _builder.Build(_query, parameters, TransformAggregateColumn);
    }

    /// <summary>
    /// Override point: transform the column SQL inside an aggregate function call.
    /// Called with the aggregate function name, the raw column SQL, and the column's
    /// schema type (from the manifest Row definition). Return the (possibly modified) column SQL.
    /// </summary>
    /// <param name="fn">Aggregate function name (e.g., "sum", "avg", "count").</param>
    /// <param name="colSql">Raw column SQL (e.g., "\"is_active\"").</param>
    /// <param name="colType">Column type from the manifest Row schema, or null if not available.</param>
    /// <returns>The column SQL to emit inside the aggregate. Base implementation returns <paramref name="colSql"/> unchanged.</returns>
    public virtual string TransformAggregateColumn(string fn, string colSql, string? colType)
    {
        return colSql;
    }
}
