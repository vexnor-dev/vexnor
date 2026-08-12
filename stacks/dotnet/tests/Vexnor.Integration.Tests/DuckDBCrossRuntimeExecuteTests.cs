using System.Text.Json;
using Vexnor.Core.Execution;
using Vexnor.DuckDB;
using Xunit;

namespace Vexnor.Integration.Tests;

public sealed class DuckDBCrossRuntimeExecuteTests : IAsyncLifetime
{
    private readonly string _directory = Path.Join(Path.GetTempPath(), $"vexnor-duckdb-manifest-{Guid.NewGuid():N}");
    private readonly QueryRegistry _registry = new("postgresql");
    private DuckDBExecutor? _executor;

    public async Task InitializeAsync()
    {
        Directory.CreateDirectory(_directory);
        _executor = DuckDBExecutor.FromPath(Path.Join(_directory, "manifest.duckdb"));
        _registry.LoadFile(GetFixturePath("manifest.json"));

        await _executor.ExecuteAsync(new SqlBuildResult("""
            CREATE SCHEMA vexnor_dev;
            CREATE TABLE vexnor_dev.account (
                account_id VARCHAR PRIMARY KEY DEFAULT uuid()::VARCHAR,
                status VARCHAR NOT NULL DEFAULT 'created',
                email VARCHAR NOT NULL,
                first_name VARCHAR NOT NULL,
                last_name VARCHAR NOT NULL,
                notes VARCHAR,
                created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
                modified_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
                parent_id VARCHAR
            );
            INSERT INTO vexnor_dev.account
                (account_id, status, email, first_name, last_name)
            VALUES
                ('uuid-123', 'active', 'jane@example.com', 'Jane', 'Duck'),
                ('id-2', 'confirmed', 'other@example.com', 'Other', 'Duck');
            """, []));
    }

    public Task DisposeAsync()
    {
        Directory.Delete(_directory, recursive: true);
        return Task.CompletedTask;
    }

    [Fact]
    public async Task ExecutesSharedTypeScriptManifestReadsAndNestedRuntimeOperators()
    {
        var executor = Assert.IsType<DuckDBExecutor>(_executor);
        var expected = LoadExpected();

        foreach (var name in new[] { "xFilterEquality", "xFilterOperators", "xFilterNestedOrAnd", "xOrderByMulti", "xPaginationBoth" })
        {
            var fixture = expected[name];
            var parameters = DeserializeParams(fixture.GetProperty("params"));
            var built = _registry.Build(name, parameters);

            Assert.Equal(fixture.GetProperty("text").GetString(), built.Text);
            Assert.Equal(
                fixture.GetProperty("values").EnumerateArray().Select(JsonElementToObject),
                built.Values);

            await _registry.ExecuteAsync(
                name,
                parameters,
                [],
                query => executor.QueryAsync(query));
        }
    }

    [Fact]
    public async Task ExecutesSharedTypeScriptManifestMutationsByHash()
    {
        var executor = Assert.IsType<DuckDBExecutor>(_executor);
        var expected = LoadExpected();

        var inserted = await Execute("xInsertSingle");
        var updated = await Execute("xSetSingle");

        Assert.Equal("a@test.com", Assert.Single(inserted)["email"]);
        Assert.Equal("updated@test.com", Assert.Single(updated)["email"]);

        async Task<List<Dictionary<string, object?>>> Execute(string hash)
        {
            var parameters = DeserializeParams(expected[hash].GetProperty("params"));
            return await _registry.ExecuteAsync(hash, parameters, [], query => executor.QueryAsync(query));
        }
    }

    [Fact]
    public async Task PreservesManifestErrorBehavior()
    {
        var executor = Assert.IsType<DuckDBExecutor>(_executor);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _registry.ExecuteAsync("missing-query", [], [], query => executor.QueryAsync(query)));
    }

    private static string GetFixturePath(string fileName)
    {
        var solutionDir = Path.GetFullPath(Path.Join("..", "..", "..", "..", ".."), AppContext.BaseDirectory);
        return Path.GetFullPath(Path.Join("..", "fixtures", "manifests", "cross-runtime", fileName), solutionDir);
    }

    private static Dictionary<string, JsonElement> LoadExpected() =>
        JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(File.ReadAllText(GetFixturePath("expected.json")))!;

    private static Dictionary<string, object?> DeserializeParams(JsonElement element)
    {
        var result = new Dictionary<string, object?>();
        foreach (var property in element.EnumerateObject())
            result[property.Name] = JsonElementToObject(property.Value);
        return result;
    }

    private static object? JsonElementToObject(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.Null => null,
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.String => element.GetString(),
        JsonValueKind.Number => element.TryGetInt64(out var number) ? number : element.GetDouble(),
        JsonValueKind.Array => element.EnumerateArray().Select(JsonElementToObject).ToArray(),
        JsonValueKind.Object => DeserializeParams(element),
        _ => element.ToString(),
    };
}
