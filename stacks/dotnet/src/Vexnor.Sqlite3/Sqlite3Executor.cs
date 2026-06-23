using System.Data.Common;
using Microsoft.Data.Sqlite;
using Vexnor.Core.Execution;

namespace Vexnor.Sqlite3;

/// <summary>
/// SQLite query executor using Microsoft.Data.Sqlite.
/// </summary>
public sealed class Sqlite3Executor : DbExecutorBase
{
    private readonly string _connectionString;

    public Sqlite3Executor(string connectionString)
    {
        _connectionString = connectionString;
    }

    /// <summary>
    /// Creates from a file path (wraps in a connection string).
    /// </summary>
    public static Sqlite3Executor FromPath(string path)
    {
        return new Sqlite3Executor($"Data Source={path}");
    }

    protected override async Task<DbConnection> OpenConnectionAsync()
    {
        var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();
        return connection;
    }

    /// <summary>
    /// SQLite uses positional ? parameters — name them $1, $2, ... to match ordinal.
    /// </summary>
    protected override void AddParameter(DbCommand cmd, int index, object? value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = $"${index + 1}";
        p.Value = value ?? DBNull.Value;
        cmd.Parameters.Add(p);
    }

    /// <summary>
    /// SQLite doesn't have a native UUID type — skip Guid coercion on input.
    /// </summary>
    protected override object? CoerceValue(object? value) => value;
}
