using System.Data.Common;
using Npgsql;
using Vexnor.Core.Execution;

namespace Vexnor.Postgres;

/// <summary>
/// PostgreSQL query executor using Npgsql.
/// </summary>
public sealed class PostgresExecutor : DbExecutorBase
{
    private readonly NpgsqlDataSource _dataSource;

    public PostgresExecutor(NpgsqlDataSource dataSource)
    {
        _dataSource = dataSource;
    }

    public PostgresExecutor(string connectionString)
    {
        _dataSource = NpgsqlDataSource.Create(connectionString);
    }

    protected override async Task<DbConnection> OpenConnectionAsync()
    {
        return await _dataSource.OpenConnectionAsync();
    }

    protected override string FormatParameterName(int index) => "";

    protected override void AddParameter(DbCommand cmd, int index, object? value)
    {
        var npgsqlCmd = (NpgsqlCommand)cmd;
        var coerced = CoerceValue(value);
        // Npgsql uses positional parameters for $1, $2, ... — add without name
        npgsqlCmd.Parameters.AddWithValue(coerced ?? DBNull.Value);
    }
}
