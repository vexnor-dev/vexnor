using System.Data.Common;
using Microsoft.Data.SqlClient;
using Vexnor.Core.Execution;

namespace Vexnor.Mssql;

/// <summary>
/// MS SQL Server query executor using Microsoft.Data.SqlClient.
/// </summary>
public sealed class MssqlExecutor : DbExecutorBase
{
    private readonly string _connectionString;

    public MssqlExecutor(string connectionString)
    {
        _connectionString = connectionString;
    }

    protected override async Task<DbConnection> OpenConnectionAsync()
    {
        var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        return connection;
    }

    protected override string FormatParameterName(int index) => $"@p{index}";
}
