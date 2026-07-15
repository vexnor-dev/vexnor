using System.Data;
using System.Data.Common;
using Vexnor.Core.Execution;
using Xunit;

namespace Vexnor.Core.Tests;

/// <summary>
/// Tests DbExecutorBase through a concrete mock subclass that uses an in-memory data table.
/// </summary>
public class DbExecutorBaseTests
{
    // ─── QueryAsync ──────────────────────────────────────────────────────────

    [Fact]
    public async Task QueryAsync_ReturnsAllRows()
    {
        var table = new DataTable();
        table.Columns.Add("id", typeof(int));
        table.Columns.Add("name", typeof(string));
        table.Rows.Add(1, "Alice");
        table.Rows.Add(2, "Bob");

        var executor = new MockDbExecutor(table);
        var result = await executor.QueryAsync(new SqlBuildResult("SELECT id, name FROM users", new List<object?>()));

        Assert.Equal(2, result.Count);
        Assert.Equal(1, result[0]["id"]);
        Assert.Equal("Alice", result[0]["name"]);
        Assert.Equal(2, result[1]["id"]);
        Assert.Equal("Bob", result[1]["name"]);
    }

    [Fact]
    public async Task QueryAsync_ReturnsEmptyList_WhenNoRows()
    {
        var table = new DataTable();
        table.Columns.Add("id", typeof(int));

        var executor = new MockDbExecutor(table);
        var result = await executor.QueryAsync(new SqlBuildResult("SELECT id FROM empty", new List<object?>()));

        Assert.Empty(result);
    }

    [Fact]
    public async Task QueryAsync_HandlesNullValues()
    {
        var table = new DataTable();
        table.Columns.Add("id", typeof(int));
        table.Columns.Add("email", typeof(string));
        table.Rows.Add(1, DBNull.Value);

        var executor = new MockDbExecutor(table);
        var result = await executor.QueryAsync(new SqlBuildResult("SELECT id, email FROM users", new List<object?>()));

        Assert.Single(result);
        Assert.Equal(1, result[0]["id"]);
        Assert.Null(result[0]["email"]);
    }

    [Fact]
    public async Task QueryAsync_NormalizesGuidToString()
    {
        var guid = Guid.NewGuid();
        var table = new DataTable();
        table.Columns.Add("id", typeof(Guid));
        table.Rows.Add(guid);

        var executor = new MockDbExecutor(table);
        var result = await executor.QueryAsync(new SqlBuildResult("SELECT id FROM t", new List<object?>()));

        Assert.Single(result);
        Assert.Equal(guid.ToString(), result[0]["id"]);
    }

    [Fact]
    public async Task QueryAsync_BindsParametersCorrectly()
    {
        var table = new DataTable();
        table.Columns.Add("id", typeof(int));
        table.Rows.Add(1);

        var executor = new MockDbExecutor(table);
        var values = new List<object?> { "test@example.com", 42 };
        await executor.QueryAsync(new SqlBuildResult("SELECT id FROM t WHERE email = @p0 AND age = @p1", values));

        Assert.Equal(2, executor.LastCommand!.Parameters.Count);
        Assert.Equal("@p0", executor.LastCommand.Parameters[0].ParameterName);
        Assert.Equal("test@example.com", executor.LastCommand.Parameters[0].Value);
        Assert.Equal("@p1", executor.LastCommand.Parameters[1].ParameterName);
        Assert.Equal(42, executor.LastCommand.Parameters[1].Value);
    }

    [Fact]
    public async Task QueryAsync_CoercesGuidStringToGuid()
    {
        var guidStr = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
        var table = new DataTable();
        table.Columns.Add("id", typeof(int));
        table.Rows.Add(1);

        var executor = new MockDbExecutor(table);
        await executor.QueryAsync(new SqlBuildResult("SELECT id FROM t WHERE id = @p0", new List<object?> { guidStr }));

        var paramValue = executor.LastCommand!.Parameters[0].Value;
        Assert.IsType<Guid>(paramValue);
        Assert.Equal(Guid.Parse(guidStr), paramValue);
    }

    [Fact]
    public async Task QueryAsync_PassesNullAsDBNull()
    {
        var table = new DataTable();
        table.Columns.Add("id", typeof(int));
        table.Rows.Add(1);

        var executor = new MockDbExecutor(table);
        await executor.QueryAsync(new SqlBuildResult("SELECT id FROM t WHERE x = @p0", new List<object?> { null }));

        Assert.Equal(DBNull.Value, executor.LastCommand!.Parameters[0].Value);
    }

    [Fact]
    public async Task QueryAsync_NonGuidString_NotCoerced()
    {
        var table = new DataTable();
        table.Columns.Add("id", typeof(int));
        table.Rows.Add(1);

        var executor = new MockDbExecutor(table);
        await executor.QueryAsync(new SqlBuildResult("SELECT 1 WHERE x = @p0", new List<object?> { "hello" }));

        Assert.Equal("hello", executor.LastCommand!.Parameters[0].Value);
    }

    // ─── ExecuteAsync ────────────────────────────────────────────────────────

    [Fact]
    public async Task ExecuteAsync_ReturnsAffectedRows()
    {
        var executor = new MockDbExecutor(null, affectedRows: 3);
        var result = await executor.ExecuteAsync(new SqlBuildResult("UPDATE t SET x = 1", new List<object?>()));

        Assert.Equal(3, result);
    }

    [Fact]
    public async Task ExecuteAsync_BindsParameters()
    {
        var executor = new MockDbExecutor(null, affectedRows: 1);
        var values = new List<object?> { "new-value", 99 };
        await executor.ExecuteAsync(new SqlBuildResult("UPDATE t SET x = @p0 WHERE id = @p1", values));

        Assert.Equal(2, executor.LastCommand!.Parameters.Count);
        Assert.Equal("@p0", executor.LastCommand.Parameters[0].ParameterName);
        Assert.Equal("new-value", executor.LastCommand.Parameters[0].Value);
    }

    [Fact]
    public async Task ExecuteAsync_WithNoParams_SetsCommandText()
    {
        var executor = new MockDbExecutor(null, affectedRows: 0);
        await executor.ExecuteAsync(new SqlBuildResult("DELETE FROM t", new List<object?>()));

        Assert.Equal("DELETE FROM t", executor.LastCommand!.CommandText);
    }

    // ─── NormalizeOutput / CoerceValue overrides ─────────────────────────────

    [Fact]
    public async Task QueryAsync_NonGuidValue_PassesThrough()
    {
        var table = new DataTable();
        table.Columns.Add("created", typeof(DateTime));
        var dt = new DateTime(2024, 6, 15, 12, 0, 0, DateTimeKind.Utc);
        table.Rows.Add(dt);

        var executor = new MockDbExecutor(table);
        var result = await executor.QueryAsync(new SqlBuildResult("SELECT created FROM t", new List<object?>()));

        Assert.Equal(dt, result[0]["created"]);
    }
}

// ─── Mock Infrastructure ─────────────────────────────────────────────────────
#pragma warning disable CS8765 // Nullability of parameter types doesn't match overridden member — DbParameterCollection signatures

/// <summary>
/// Concrete DbExecutorBase implementation using in-memory DataTable for testing.
/// </summary>
internal sealed class MockDbExecutor : DbExecutorBase
{
    private readonly DataTable? _table;
    private readonly int _affectedRows;

    public MockDbCommand? LastCommand { get; private set; }

    public MockDbExecutor(DataTable? table, int affectedRows = 0)
    {
        _table = table ?? new DataTable();
        _affectedRows = affectedRows;
    }

    protected override Task<DbConnection> OpenConnectionAsync()
    {
        var connection = new MockDbConnection(_table!, _affectedRows, cmd => LastCommand = cmd);
        return Task.FromResult<DbConnection>(connection);
    }
}

internal sealed class MockDbConnection : DbConnection
{
    private readonly DataTable _table;
    private readonly int _affectedRows;
    private readonly Action<MockDbCommand> _onCommandCreated;

    public MockDbConnection(DataTable table, int affectedRows, Action<MockDbCommand> onCommandCreated)
    {
        _table = table;
        _affectedRows = affectedRows;
        _onCommandCreated = onCommandCreated;
    }

    public override string ConnectionString { get; set; } = "";
    public override string Database => "mock";
    public override string DataSource => "mock";
    public override string ServerVersion => "1.0";
    public override ConnectionState State => ConnectionState.Open;

    public override void ChangeDatabase(string databaseName) { }
    public override void Close() { }
    public override void Open() { }

    protected override DbTransaction BeginDbTransaction(IsolationLevel isolationLevel) =>
        throw new NotImplementedException();

    protected override DbCommand CreateDbCommand()
    {
        var cmd = new MockDbCommand(_table, _affectedRows);
        _onCommandCreated(cmd);
        return cmd;
    }
}

internal sealed class MockDbCommand : DbCommand
{
    private readonly DataTable _table;
    private readonly int _affectedRows;
    private readonly MockDbParameterCollection _parameters = new();

    public MockDbCommand(DataTable table, int affectedRows)
    {
        _table = table;
        _affectedRows = affectedRows;
    }

    public override string CommandText { get; set; } = "";
    public override int CommandTimeout { get; set; }
    public override CommandType CommandType { get; set; }
    public override bool DesignTimeVisible { get; set; }
    public override UpdateRowSource UpdatedRowSource { get; set; }
    protected override DbConnection? DbConnection { get; set; }
    protected override DbTransaction? DbTransaction { get; set; }
    protected override DbParameterCollection DbParameterCollection => _parameters;

    public new MockDbParameterCollection Parameters => _parameters;

    public override void Cancel() { }
    public override int ExecuteNonQuery() => _affectedRows;
    public override object? ExecuteScalar() => null;
    public override void Prepare() { }

    protected override DbParameter CreateDbParameter() => new MockDbParameter();

    protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior) =>
        new DataTableReader(_table);
}

internal sealed class MockDbParameter : DbParameter
{
    public override DbType DbType { get; set; }
    public override ParameterDirection Direction { get; set; }
    public override bool IsNullable { get; set; }
    public override string ParameterName { get; set; } = "";
    public override int Size { get; set; }
    public override string SourceColumn { get; set; } = "";
    public override bool SourceColumnNullMapping { get; set; }
    public override object? Value { get; set; }

    public override void ResetDbType() { }
}

internal sealed class MockDbParameterCollection : DbParameterCollection
{
    private readonly List<MockDbParameter> _params = new();

    public override int Count => _params.Count;
    public override object SyncRoot => this;

    public new MockDbParameter this[int index] => _params[index];

    public override int Add(object? value)
    {
        _params.Add((MockDbParameter)value!);
        return _params.Count - 1;
    }

    public override void AddRange(Array values)
    {
        foreach (var v in values) Add(v);
    }

    public override void Clear() => _params.Clear();
    public override bool Contains(object? value) => _params.Contains(value);
    public override bool Contains(string value) => _params.Any(p => p.ParameterName == value);
    public override void CopyTo(Array array, int index) { }
    public override System.Collections.IEnumerator GetEnumerator() => _params.GetEnumerator();
    public override int IndexOf(object? value) => _params.IndexOf((MockDbParameter)value!);
    public override int IndexOf(string parameterName) => _params.FindIndex(p => p.ParameterName == parameterName);
    public override void Insert(int index, object? value) => _params.Insert(index, (MockDbParameter)value!);
    public override void Remove(object? value) => _params.Remove((MockDbParameter)value!);
    public override void RemoveAt(int index) => _params.RemoveAt(index);
    public override void RemoveAt(string parameterName) => _params.RemoveAll(p => p.ParameterName == parameterName);
    protected override DbParameter GetParameter(int index) => _params[index];
    protected override DbParameter GetParameter(string parameterName) => _params.First(p => p.ParameterName == parameterName);
    protected override void SetParameter(int index, DbParameter value) => _params[index] = (MockDbParameter)value;
    protected override void SetParameter(string parameterName, DbParameter value)
    {
        var idx = IndexOf(parameterName);
        if (idx >= 0) _params[idx] = (MockDbParameter)value;
    }
}
