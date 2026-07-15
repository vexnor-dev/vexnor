using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

/// <summary>
/// Tests for QueryRegistry.ExecuteAsync pipeline execution, including:
/// - Unknown hash errors
/// - Full pipeline with plugins
/// - Structured param validation (filter, projection)
/// - Authorization denial via pipeline
/// - Context injection paths
/// </summary>
public class QueryRegistryExecuteTests
{
    // ─── Unknown hash ────────────────────────────────────────────────────────

    [Fact]
    public async Task ExecuteAsync_UnknownHash_Throws()
    {
        var registry = new QueryRegistry("postgresql");

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            registry.ExecuteAsync("nonexistent", new(), new(),
                _ => Task.FromResult(new List<Dictionary<string, object?>>())));

        Assert.Contains("Unknown query hash", ex.Message);
        Assert.Contains("nonexistent", ex.Message);
    }

    [Fact]
    public void Build_UnknownHash_Throws()
    {
        var registry = new QueryRegistry("postgresql");

        var ex = Assert.Throws<InvalidOperationException>(() =>
            registry.Build("nonexistent", new()));

        Assert.Contains("Unknown query hash", ex.Message);
    }

    // ─── Filter validation through ExecuteAsync ──────────────────────────────

    [Fact]
    public async Task ExecuteAsync_FilterValidation_InvalidOperator_Throws()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "filterTest",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT * FROM t WHERE " }, new FilterNode { Param = "filter", Columns = new() { ["email"] = "\"email\"" } } },
                    Params = new()
                    {
                        ["filter"] = new ParamDefinition
                        {
                            Name = "filter",
                            Validation = new ParamValidationSchema
                            {
                                Type = "filter",
                                Columns = new() { "email" },
                                Operators = new() { "=", "like" },
                            }
                        }
                    }
                }
            }
        });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            registry.ExecuteAsync("h1",
                new() { ["filter"] = new object?[] { new Dictionary<string, object?> { ["email"] = new object?[] { "dropTable", "x" } } } },
                new(),
                _ => Task.FromResult<object?>(null)));

        Assert.Contains("Invalid filter operator", ex.Message);
        Assert.Contains("dropTable", ex.Message);
    }

    [Fact]
    public async Task ExecuteAsync_FilterValidation_OrCondition_InvalidColumn_Throws()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "orFilter",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT * FROM t WHERE " }, new FilterNode { Param = "filter", Columns = new() { ["email"] = "\"email\"" } } },
                    Params = new()
                    {
                        ["filter"] = new ParamDefinition
                        {
                            Name = "filter",
                            Validation = new ParamValidationSchema
                            {
                                Type = "filter",
                                Columns = new() { "email" },
                                Operators = new() { "=" },
                            }
                        }
                    }
                }
            }
        });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            registry.ExecuteAsync("h1",
                new()
                {
                    ["filter"] = new object?[]
                    {
                        new Dictionary<string, object?>
                        {
                            ["or"] = new object?[]
                            {
                                new Dictionary<string, object?> { ["badColumn"] = new object?[] { "=", "x" } }
                            }
                        }
                    }
                },
                new(),
                _ => Task.FromResult<object?>(null)));

        Assert.Contains("Column not found", ex.Message);
        Assert.Contains("badColumn", ex.Message);
    }

    [Fact]
    public async Task ExecuteAsync_FilterValidation_ValidFilter_Succeeds()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "validFilter",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT * FROM t WHERE " }, new FilterNode { Param = "filter", Columns = new() { ["email"] = "\"email\"" } } },
                    Params = new()
                    {
                        ["filter"] = new ParamDefinition
                        {
                            Name = "filter",
                            Validation = new ParamValidationSchema
                            {
                                Type = "filter",
                                Columns = new() { "email" },
                                Operators = new() { "=", "like" },
                            }
                        }
                    }
                }
            }
        });

        SqlBuildResult? captured = null;
        await registry.ExecuteAsync("h1",
            new() { ["filter"] = new object?[] { new Dictionary<string, object?> { ["email"] = new object?[] { "like", "%@test.com" } } } },
            new(),
            sql => { captured = sql; return Task.FromResult<object?>(null); });

        Assert.NotNull(captured);
    }

    // ─── Projection validation through ExecuteAsync ──────────────────────────

    [Fact]
    public async Task ExecuteAsync_ProjectionValidation_InvalidColumn_Throws()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "projTest",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT " }, new ProjectionNode { Param = "select", Columns = new() { ["email"] = "\"email\"", ["name"] = "\"name\"" } }, new TextNode { Value = " FROM t" } },
                    Params = new()
                    {
                        ["select"] = new ParamDefinition
                        {
                            Name = "select",
                            Validation = new ParamValidationSchema
                            {
                                Type = "projection",
                                Columns = new() { "email", "name" },
                                Functions = new() { "count", "sum" },
                            }
                        }
                    }
                }
            }
        });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            registry.ExecuteAsync("h1",
                new() { ["select"] = new object?[] { "hackedColumn" } },
                new(),
                _ => Task.FromResult<object?>(null)));

        Assert.Contains("Column not found", ex.Message);
        Assert.Contains("hackedColumn", ex.Message);
    }

    [Fact]
    public async Task ExecuteAsync_ProjectionValidation_InvalidFunction_Throws()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "projFnTest",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT " }, new ProjectionNode { Param = "select", Columns = new() { ["email"] = "\"email\"" } }, new TextNode { Value = " FROM t" } },
                    Params = new()
                    {
                        ["select"] = new ParamDefinition
                        {
                            Name = "select",
                            Validation = new ParamValidationSchema
                            {
                                Type = "projection",
                                Columns = new() { "email" },
                                Functions = new() { "count", "sum" },
                            }
                        }
                    }
                }
            }
        });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            registry.ExecuteAsync("h1",
                new() { ["select"] = new object?[] { new object?[] { "dropTable", "email", "alias" } } },
                new(),
                _ => Task.FromResult<object?>(null)));

        Assert.Contains("Invalid aggregate function", ex.Message);
        Assert.Contains("dropTable", ex.Message);
    }

    [Fact]
    public async Task ExecuteAsync_ProjectionValidation_ValidProjection_Succeeds()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "validProj",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT " }, new ProjectionNode { Param = "select", Columns = new() { ["email"] = "\"email\"", ["name"] = "\"name\"" } }, new TextNode { Value = " FROM t" } },
                    Params = new()
                    {
                        ["select"] = new ParamDefinition
                        {
                            Name = "select",
                            Validation = new ParamValidationSchema
                            {
                                Type = "projection",
                                Columns = new() { "email", "name" },
                                Functions = new() { "count" },
                            }
                        }
                    }
                }
            }
        });

        SqlBuildResult? captured = null;
        await registry.ExecuteAsync("h1",
            new() { ["select"] = new object?[] { "email", new object?[] { "count", "name", "cnt" } } },
            new(),
            sql => { captured = sql; return Task.FromResult<object?>(null); });

        Assert.NotNull(captured);
    }

    // ─── Null / missing validation value ─────────────────────────────────────

    [Fact]
    public async Task ExecuteAsync_NullParamWithValidation_IsSkipped()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "nullParamTest",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT 1" } },
                    Params = new()
                    {
                        ["filter"] = new ParamDefinition
                        {
                            Name = "filter",
                            Validation = new ParamValidationSchema
                            {
                                Type = "filter",
                                Columns = new() { "email" },
                                Operators = new() { "=" },
                            }
                        }
                    }
                }
            }
        });

        // null param value — validation should be skipped
        await registry.ExecuteAsync("h1",
            new() { ["filter"] = null },
            new(),
            _ => Task.FromResult<object?>(null));
    }

    [Fact]
    public async Task ExecuteAsync_MissingParamWithValidation_IsSkipped()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "missingParamTest",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT 1" } },
                    Params = new()
                    {
                        ["filter"] = new ParamDefinition
                        {
                            Name = "filter",
                            Validation = new ParamValidationSchema
                            {
                                Type = "filter",
                                Columns = new() { "email" },
                                Operators = new() { "=" },
                            }
                        }
                    }
                }
            }
        });

        // param not even present — validation should be skipped
        await registry.ExecuteAsync("h1",
            new(),
            new(),
            _ => Task.FromResult<object?>(null));
    }

    // ─── Unknown validation type ─────────────────────────────────────────────

    [Fact]
    public async Task ExecuteAsync_UnknownValidationType_IsIgnored()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "unknownTypeTest",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT 1" } },
                    Params = new()
                    {
                        ["custom"] = new ParamDefinition
                        {
                            Name = "custom",
                            Validation = new ParamValidationSchema
                            {
                                Type = "unknownType",
                                Columns = new() { "x" },
                            }
                        }
                    }
                }
            }
        });

        // Unknown type — should not throw
        await registry.ExecuteAsync("h1",
            new() { ["custom"] = "some-value" },
            new(),
            _ => Task.FromResult<object?>(null));
    }

    // ─── Pipeline integration via ExecuteAsync ───────────────────────────────

    [Fact]
    public async Task ExecuteAsync_RunsThroughPipelineWithPlugins()
    {
        var registry = new QueryRegistry("postgresql");
        var tracker = new CallTracker();
        registry.Use(tracker);

        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "pipelineTest",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT 1" } },
                }
            }
        });

        await registry.ExecuteAsync("h1", new(), new(),
            _ => Task.FromResult<object?>("result"));

        Assert.Contains("Init", tracker.Calls);
        Assert.Contains("End", tracker.Calls);
    }

    [Fact]
    public async Task ExecuteAsync_AuthDenial_ThrowsAndEndsPlugin()
    {
        var registry = new QueryRegistry("postgresql");
        registry.RegisterAuthorization(_ => throw new InvalidOperationException("forbidden"));
        var tracker = new CallTracker();
        registry.Use(tracker);

        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "authTest",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT 1" } },
                    Authorization = new() { "admin" },
                }
            }
        });

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            registry.ExecuteAsync("h1", new(), new(),
                _ => Task.FromResult<object?>(null)));

        Assert.Contains("Init", tracker.Calls);
        Assert.Contains("End", tracker.Calls);
    }

    // ─── Introspection ───────────────────────────────────────────────────────

    [Fact]
    public void GetRegisteredHashes_ReturnsAllHashes()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition { Name = "q1" },
                ["h2"] = new QueryDefinition { Name = "q2" },
            }
        });

        var hashes = registry.GetRegisteredHashes();
        Assert.Equal(2, hashes.Count);
        Assert.Contains("h1", hashes);
        Assert.Contains("h2", hashes);
    }

    [Fact]
    public void GetQuery_ReturnsDefinitionOrNull()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition { Name = "q1" },
            }
        });

        Assert.NotNull(registry.GetQuery("h1"));
        Assert.Equal("q1", registry.GetQuery("h1")!.Name);
        Assert.Null(registry.GetQuery("nonexistent"));
    }

    [Fact]
    public void GetRegisteredQueries_ReturnsHashNamePairs()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition { Name = "alpha" },
                ["h2"] = new QueryDefinition { Name = "beta" },
            }
        });

        var queries = registry.GetRegisteredQueries().OrderBy(q => q.Name).ToList();
        Assert.Equal(2, queries.Count);
        Assert.Equal(("h1", "alpha"), queries[0]);
        Assert.Equal(("h2", "beta"), queries[1]);
    }

    // ─── Non-context param is not injected ───────────────────────────────────

    [Fact]
    public async Task ExecuteAsync_NonContextParam_NotInjected()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "regular",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT * WHERE id = " }, new ParamNode { Name = "id" } },
                    Params = new() { ["id"] = new ParamDefinition { Name = "id", IsContext = false } },
                }
            }
        });

        SqlBuildResult? captured = null;
        await registry.ExecuteAsync("h1",
            new() { ["id"] = "val-123" },
            new() { ["id"] = "context-val" },
            sql => { captured = sql; return Task.FromResult<object?>(null); });

        // The original param value should be used, not context
        Assert.Contains("val-123", captured!.Values.Select(v => v?.ToString()));
    }

    // ─── Deregister authorization hook ───────────────────────────────────────

    [Fact]
    public async Task RegisterAuthorization_ReturnsDeregisterAction()
    {
        var registry = new QueryRegistry("postgresql");
        var deregister = registry.RegisterAuthorization(_ => throw new InvalidOperationException("denied"));

        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "authDeregTest",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT 1" } },
                    Authorization = new() { "admin" },
                }
            }
        });

        // Should throw with hook registered
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            registry.ExecuteAsync("h1", new(), new(), _ => Task.FromResult<object?>(null)));

        // Deregister and try again — should succeed
        deregister();
        await registry.ExecuteAsync("h1", new(), new(), _ => Task.FromResult<object?>("ok"));
    }

    // ─── Projection validation — non-array value is ignored ──────────────────

    [Fact]
    public async Task ExecuteAsync_ProjectionValidation_NonArrayValue_IsIgnored()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1,
            Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "projNonArray",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT 1" } },
                    Params = new()
                    {
                        ["select"] = new ParamDefinition
                        {
                            Name = "select",
                            Validation = new ParamValidationSchema
                            {
                                Type = "projection",
                                Columns = new() { "email" },
                                Functions = new() { "count" },
                            }
                        }
                    }
                }
            }
        });

        // Non-array value for projection type — should not throw
        await registry.ExecuteAsync("h1",
            new() { ["select"] = "not-an-array" },
            new(),
            _ => Task.FromResult<object?>(null));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private sealed class CallTracker : IQueryPipelinePlugin
    {
        public string Name => "tracker";
        public List<string> Calls { get; } = new();

        public void Init(PipelineExecutionArgs args) => Calls.Add("Init");
        public void End(PipelineEndArgs args) => Calls.Add("End");
    }
}
