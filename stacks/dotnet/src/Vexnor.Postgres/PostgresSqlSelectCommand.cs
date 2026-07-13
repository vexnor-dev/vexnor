using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;

namespace Vexnor.Postgres;

/// <summary>
/// PostgreSQL-specific SELECT command.
/// Appends ::int cast to boolean columns inside SUM/AVG aggregates,
/// since PostgreSQL does not natively support SUM/AVG on boolean.
/// </summary>
public class PostgresSqlSelectCommand : SqlSelectCommand
{
    public PostgresSqlSelectCommand(QueryDefinition query) : base(query, "postgresql") { }

    /// <inheritdoc />
    public override string TransformAggregateColumn(string fn, string colSql, string? colType)
    {
        if ((fn == "sum" || fn == "avg") && colType == "boolean")
            return colSql + "::int";

        return colSql;
    }
}
