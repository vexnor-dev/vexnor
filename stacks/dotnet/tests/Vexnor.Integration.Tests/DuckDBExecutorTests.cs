using System.Reflection;
using System.Reflection.Emit;
using System.Text.Json;
using DuckDB.NET.Data;
using DuckDB.NET.Native;
using Vexnor.Core.Execution;
using Vexnor.DuckDB;
using Xunit;

namespace Vexnor.Integration.Tests;

public sealed class DuckDBExecutorTests : IDisposable
{
    private readonly string _directory = Path.Join(Path.GetTempPath(), $"vexnor-duckdb-{Guid.NewGuid():N}");
    private readonly DuckDBExecutor _executor;

    public DuckDBExecutorTests()
    {
        Directory.CreateDirectory(_directory);
        _executor = DuckDBExecutor.FromPath(Path.Join(_directory, "integration.duckdb"));
    }

    [Fact]
    public async Task ExecutesParameterizedReadsAndWrites()
    {
        await _executor.ExecuteAsync(new SqlBuildResult(
            "CREATE TABLE account (account_id INTEGER PRIMARY KEY, email VARCHAR NOT NULL)", []));
        await _executor.ExecuteAsync(new SqlBuildResult(
            "INSERT INTO account VALUES ($1, $2)", [42, "duck@example.com"]));

        var rows = await _executor.QueryAsync(new SqlBuildResult(
            "SELECT account_id AS accountId, email FROM account WHERE account_id = $1", [42]));

        var row = Assert.Single(rows);
        Assert.Equal(42, row["accountId"]);
        Assert.Equal("duck@example.com", row["email"]);
    }

    [Fact]
    public async Task BindsNullParameters()
    {
        await _executor.ExecuteAsync(new SqlBuildResult(
            "CREATE TABLE nullable_value (value VARCHAR)", []));
        await _executor.ExecuteAsync(new SqlBuildResult(
            "INSERT INTO nullable_value VALUES ($1)", [null]));

        var rows = await _executor.QueryAsync(new SqlBuildResult(
            "SELECT value FROM nullable_value", []));

        Assert.Null(Assert.Single(rows)["value"]);
    }

    [Fact]
    public async Task HonorsCancellation()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            _executor.QueryAsync(new SqlBuildResult("SELECT 1", []), cancellation.Token));
    }

    [Fact]
    public async Task ReusesAnInMemoryDatabaseAcrossOperations()
    {
        await using var executor = DuckDBExecutor.Memory();

        await executor.ExecuteAsync(new SqlBuildResult(
            "CREATE TABLE account (account_id INTEGER PRIMARY KEY)", []));

        var rows = await executor.QueryAsync(new SqlBuildResult(
            "SELECT COUNT(*) AS count FROM account", []));

        var row = Assert.Single(rows);
        Assert.Equal(0L, row["count"]);
    }

    [Fact]
    public async Task NormalizesDuckDbNativeValuesForPortableJson()
    {
        var rows = await _executor.QueryAsync(new SqlBuildResult("""
            SELECT
                '00000000-0000-4000-8000-000000000001'::UUID AS uuid,
                123.45::DECIMAL(10,2) AS decimal,
                123456789012345678901234567890::HUGEINT AS hugeint,
                DATE '2026-08-10' AS date,
                TIME '12:34:56.789' AS time,
                TIMESTAMP '2026-08-10 12:34:56.789' AS timestamp,
                [1, 2]::INTEGER[] AS list,
                {'answer': 42}::STRUCT(answer INTEGER) AS struct,
                MAP {'one': 1} AS map,
                'abc'::BLOB AS blob,
                '{"answer":42}'::JSON AS json
            """, []));

        var row = Assert.Single(rows);
        Assert.IsType<string>(row["uuid"]);
        Assert.IsType<string>(row["decimal"]);
        Assert.IsType<string>(row["hugeint"]);
        Assert.IsType<string>(row["date"]);
        Assert.IsType<string>(row["time"]);
        Assert.IsType<string>(row["timestamp"]);
        Assert.IsType<object[]>(row["list"]);
        Assert.IsType<Dictionary<string, object?>>(row["struct"]);
        Assert.IsType<Dictionary<string, object?>>(row["map"]);
        Assert.IsType<byte[]>(row["blob"]);
        Assert.IsType<string>(row["json"]);
        Assert.Equal(
            "[{\"uuid\":\"00000000-0000-4000-8000-000000000001\",\"decimal\":\"123.45\",\"hugeint\":\"123456789012345678901234567890\",\"date\":\"2026-08-10T00:00:00Z\",\"time\":\"12:34:56.789\",\"timestamp\":\"2026-08-10T12:34:56.789Z\",\"list\":[1,2],\"struct\":{\"answer\":42},\"map\":{\"one\":1},\"blob\":\"YWJj\",\"json\":\"{\\u0022answer\\u0022:42}\"}]",
            JsonSerializer.Serialize(rows));
    }

    [Fact]
    public void NormalizesProviderFallbackValues()
    {
        var normalizeOutput = typeof(DuckDBExecutor).GetMethod(
            "NormalizeOutput",
            BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(normalizeOutput);

        var offset = new DateTimeOffset(2026, 8, 10, 12, 34, 56, 789, TimeSpan.FromHours(2));
        Assert.Equal(
            "2026-08-10T10:34:56.789Z",
            normalizeOutput.Invoke(_executor, [offset]));

        byte[] bytes = [1, 2, 3];
        Assert.Same(bytes, normalizeOutput.Invoke(_executor, [bytes]));

        using var stream = new MemoryStream([4, 5, 6]);
        Assert.Equal(
            [4, 5, 6],
            Assert.IsType<byte[]>(normalizeOutput.Invoke(_executor, [stream])));

        var value = new object();
        Assert.Same(value, normalizeOutput.Invoke(_executor, [value]));

        var namespaceLessType = AssemblyBuilder
            .DefineDynamicAssembly(new AssemblyName("VexnorNamespaceLessTests"), AssemblyBuilderAccess.Run)
            .DefineDynamicModule("VexnorNamespaceLessTests")
            .DefineType("NamespaceLessValue")
            .CreateType();
        var namespaceLessValue = Activator.CreateInstance(namespaceLessType);
        Assert.Same(namespaceLessValue, normalizeOutput.Invoke(_executor, [namespaceLessValue]));

        var providerValue = new DuckDBInterval(1, 2, 3);
        Assert.Equal(providerValue, normalizeOutput.Invoke(_executor, [providerValue]));
    }

    [Fact]
    public async Task ValidatesConnectionModesAndDisposesIdempotently()
    {
        Assert.Throws<ArgumentException>(() => DuckDBExecutor.FromPath(" "));
        Assert.Throws<ArgumentException>(() => DuckDBExecutor.MotherDuck("", "token"));
        Assert.Throws<ArgumentException>(() => DuckDBExecutor.MotherDuck("analytics", ""));

        await using var motherDuck = DuckDBExecutor.MotherDuck("analytics", "token with spaces");

        var executor = DuckDBExecutor.Memory();
        await executor.DisposeAsync();
        await executor.DisposeAsync();

        await Assert.ThrowsAsync<ObjectDisposedException>(() =>
            executor.QueryAsync(new SqlBuildResult("SELECT 1", [])));
    }

    [Fact]
    public async Task IntrospectsPortableSchemaMetadata()
    {
        await _executor.ExecuteAsync(new SqlBuildResult("""
            CREATE TYPE item_state AS ENUM ('open', 'closed');
            CREATE TABLE parent (parent_id INTEGER PRIMARY KEY);
            CREATE TABLE item (
                item_id INTEGER PRIMARY KEY,
                parent_id INTEGER REFERENCES parent(parent_id),
                state item_state NOT NULL DEFAULT 'open'
            );
            CREATE VIEW open_item AS SELECT * FROM item WHERE state = 'open';
            """, []));

        var schema = await _executor.GetSchemaAsync(["main"]);
        Assert.Equal(["item", "open_item", "parent"], schema.Tables.Select(table => table.TableName));
        Assert.Equal(["table", "view", "table"], schema.Tables.Select(table => table.TableType));

        var item = schema.Tables[0];
        Assert.Equal(["item_id", "parent_id", "state"], item.Columns.Select(column => column.ColumnName));
        Assert.Equal(["NO", "YES", "NO"], item.Columns.Select(column => column.IsNullable));
        Assert.Equal(["YES", "YES", "YES"], item.Columns.Select(column => column.IsUpdatable));
        Assert.Equal("item_id", Assert.Single(item.PrimaryKeys).ColumnName);
        var foreignKey = Assert.Single(item.ForeignKeys);
        Assert.Equal("parent_id", foreignKey.ColumnName);
        Assert.Equal("parent", foreignKey.ReferencedTableName);
        Assert.Equal("parent_id", foreignKey.ReferencedColumnName);

        var enumType = Assert.Single(schema.Enums);
        Assert.Equal("item_state", enumType.EnumName);
        Assert.Equal(["open", "closed"], enumType.EnumValues.Select(value => value.EnumLabel));
        await Assert.ThrowsAsync<ArgumentException>(() => _executor.GetSchemaAsync([]));
    }

    [Fact]
    public void RejectsInvalidSchemaMetadata()
    {
        var readEnumValues = typeof(DuckDBExecutor).GetMethod(
            "ReadEnumValues",
            BindingFlags.Static | BindingFlags.NonPublic);
        var requiredString = typeof(DuckDBExecutor).GetMethod(
            "RequiredString",
            BindingFlags.Static | BindingFlags.NonPublic);
        var optionalString = typeof(DuckDBExecutor).GetMethod(
            "OptionalString",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(readEnumValues);
        Assert.NotNull(requiredString);
        Assert.NotNull(optionalString);

        var nullLabels = Assert.Throws<TargetInvocationException>(() =>
            readEnumValues.Invoke(null, [null]));
        Assert.IsType<InvalidDataException>(nullLabels.InnerException);

        var stringLabels = Assert.Throws<TargetInvocationException>(() =>
            readEnumValues.Invoke(null, ["open"]));
        Assert.IsType<InvalidDataException>(stringLabels.InnerException);

        var enumValues = Assert.IsType<List<DuckDBEnumValue>>(
            readEnumValues.Invoke(null, [new object?[] { null }]));
        Assert.Equal(string.Empty, Assert.Single(enumValues).EnumLabel);

        IReadOnlyDictionary<string, object?> invalidRow = new Dictionary<string, object?>
        {
            ["required"] = 42,
            ["optional"] = 42
        };
        var invalidRequired = Assert.Throws<TargetInvocationException>(() =>
            requiredString.Invoke(null, [invalidRow, "required"]));
        Assert.IsType<InvalidDataException>(invalidRequired.InnerException);
        var invalidOptional = Assert.Throws<TargetInvocationException>(() =>
            optionalString.Invoke(null, [invalidRow, "optional"]));
        Assert.IsType<InvalidDataException>(invalidOptional.InnerException);
    }

    public void Dispose()
    {
        Directory.Delete(_directory, recursive: true);
    }
}
