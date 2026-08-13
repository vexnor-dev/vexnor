using System.Collections;
using System.Data.Common;
using System.Globalization;
using System.Numerics;
using DuckDB.NET.Data;
using Vexnor.Core.Execution;

namespace Vexnor.DuckDB;

/// <summary>
/// DuckDB query executor using the official DuckDB.NET ADO.NET provider.
/// </summary>
public sealed partial class DuckDBExecutor : DbExecutorBase, IAsyncDisposable
{
    private readonly string _connectionString;
    private readonly bool _persistent;
    private readonly SemaphoreSlim _connectionGate = new(1, 1);
    private DuckDBConnection? _persistentConnection;
    private bool _disposed;

    public DuckDBExecutor(string connectionString, bool persistent = false)
    {
        _connectionString = connectionString;
        _persistent = persistent;
    }

    public static DuckDBExecutor FromPath(string path)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        return new DuckDBExecutor($"Data Source={path}");
    }

    public static DuckDBExecutor Memory() => new("Data Source=:memory:", persistent: true);

    public static DuckDBExecutor MotherDuck(string database, string token)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(database);
        ArgumentException.ThrowIfNullOrWhiteSpace(token);
        var path = $"md:{database}?motherduck_token={Uri.EscapeDataString(token)}";
        return FromPath(path);
    }

    protected override async Task<DbConnection> OpenConnectionAsync(CancellationToken cancellationToken)
    {
        if (_persistent)
        {
            await _connectionGate.WaitAsync(cancellationToken);
            try
            {
                ObjectDisposedException.ThrowIf(_disposed, this);
                if (_persistentConnection is null)
                {
                    _persistentConnection = new DuckDBConnection(_connectionString);
                    await _persistentConnection.OpenAsync(cancellationToken);
                }
                return _persistentConnection;
            }
            catch
            {
                _connectionGate.Release();
                throw;
            }
        }

        ObjectDisposedException.ThrowIf(_disposed, this);
        var connection = new DuckDBConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }

    protected override ValueTask ReleaseConnectionAsync(DbConnection connection)
    {
        if (_persistent)
        {
            _connectionGate.Release();
            return ValueTask.CompletedTask;
        }

        return connection.DisposeAsync();
    }

    protected override void AddParameter(DbCommand cmd, int index, object? value)
    {
        var parameter = new DuckDBParameter($"{index + 1}", CoerceValue(value) ?? DBNull.Value);
        cmd.Parameters.Add(parameter);
    }

    public async ValueTask DisposeAsync()
    {
        await _connectionGate.WaitAsync();
        try
        {
            if (_disposed)
            {
                return;
            }

            _disposed = true;
            if (_persistentConnection is not null)
            {
                await _persistentConnection.DisposeAsync();
                _persistentConnection = null;
            }
        }
        finally
        {
            _connectionGate.Release();
        }
    }

    protected override object? NormalizeOutput(object? value)
    {
        return value switch
        {
            null => null,
            Guid guid => guid.ToString(),
            decimal number => number.ToString(CultureInfo.InvariantCulture),
            BigInteger number => number.ToString(CultureInfo.InvariantCulture),
            DateOnly date => date.ToDateTime(TimeOnly.MinValue).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture),
            TimeOnly time => time.ToString("HH:mm:ss.FFFFFFF", CultureInfo.InvariantCulture),
            DateTime timestamp => timestamp.ToString("yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'", CultureInfo.InvariantCulture),
            DateTimeOffset timestamp => timestamp.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'", CultureInfo.InvariantCulture),
            byte[] bytes => bytes,
            Stream stream => ReadStream(stream),
            IDictionary dictionary => NormalizeDictionary(dictionary),
            IEnumerable sequence when value is not string => sequence.Cast<object?>().Select(NormalizeOutput).ToArray(),
            _ when value.GetType().Namespace?.StartsWith("DuckDB.NET", StringComparison.Ordinal) == true => value.ToString(),
            _ => value
        };
    }

    private static byte[] ReadStream(Stream stream)
    {
        using var output = new MemoryStream();
        stream.CopyTo(output);
        return output.ToArray();
    }

    private Dictionary<string, object?> NormalizeDictionary(IDictionary dictionary)
    {
        var result = new Dictionary<string, object?>();
        foreach (DictionaryEntry entry in dictionary)
        {
            result[Convert.ToString(entry.Key, CultureInfo.InvariantCulture)!] = NormalizeOutput(entry.Value);
        }
        return result;
    }
}
