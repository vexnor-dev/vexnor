using System.Data.Common;

namespace Vexnor.Core.Execution;

/// <summary>
/// Base query executor using ADO.NET System.Data.Common abstractions.
/// Subclasses provide a connection and configure parameter binding for their dialect.
/// </summary>
public abstract class DbExecutorBase
{
    /// <summary>
    /// Creates and opens a new connection.
    /// </summary>
    protected abstract Task<DbConnection> OpenConnectionAsync();

    /// <summary>
    /// Adds a parameter to the command. Override to handle dialect-specific type coercion.
    /// </summary>
    protected virtual void AddParameter(DbCommand cmd, int index, object? value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = FormatParameterName(index);
        p.Value = CoerceValue(value) ?? DBNull.Value;
        cmd.Parameters.Add(p);
    }

    /// <summary>
    /// Returns the parameter placeholder name for a given index (e.g. "@p0" for MSSQL, not used for positional).
    /// </summary>
    protected virtual string FormatParameterName(int index) => $"@p{index}";

    /// <summary>
    /// Coerces a value before binding. Default: converts UUID strings to Guid.
    /// </summary>
    protected virtual object? CoerceValue(object? value)
    {
        if (value is string s && Guid.TryParse(s, out var guid))
            return guid;
        return value;
    }

    /// <summary>
    /// Normalizes a value read from the reader for JSON output. Default: converts Guid to string.
    /// </summary>
    protected virtual object? NormalizeOutput(object? value)
    {
        return value is Guid g ? g.ToString() : value;
    }

    /// <summary>
    /// Executes a query and returns all rows as dictionaries.
    /// </summary>
    public async Task<List<Dictionary<string, object?>>> QueryAsync(SqlBuildResult query)
    {
        await using var connection = await OpenConnectionAsync();
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = query.Text;

        for (int i = 0; i < query.Values.Count; i++)
        {
            AddParameter(cmd, i, query.Values[i]);
        }

        await using var reader = await cmd.ExecuteReaderAsync();
        var results = new List<Dictionary<string, object?>>();

        while (await reader.ReadAsync())
        {
            var row = new Dictionary<string, object?>();
            for (int i = 0; i < reader.FieldCount; i++)
            {
                var name = reader.GetName(i);
                var val = reader.IsDBNull(i) ? null : reader.GetValue(i);
                row[name] = NormalizeOutput(val);
            }
            results.Add(row);
        }

        return results;
    }

    /// <summary>
    /// Executes a query and returns the number of affected rows.
    /// </summary>
    public async Task<int> ExecuteAsync(SqlBuildResult query)
    {
        await using var connection = await OpenConnectionAsync();
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = query.Text;

        for (int i = 0; i < query.Values.Count; i++)
        {
            AddParameter(cmd, i, query.Values[i]);
        }

        return await cmd.ExecuteNonQueryAsync();
    }
}
