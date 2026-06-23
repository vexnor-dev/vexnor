using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

public class QueryPipelineTests
{
    [Fact]
    public async Task ExecuteAsync_RunsFullLifecycle()
    {
        var pipeline = new QueryPipeline();
        var tracker = new LifecycleTracker();
        pipeline.Use(tracker);

        var args = MakeArgs();
        var result = await pipeline.ExecuteAsync(args, () => Task.FromResult("ok"));

        Assert.Equal("ok", result);
        Assert.Equal(["Init", "Check", "Before", "End"], tracker.Calls);
    }

    [Fact]
    public async Task ExecuteAsync_EndFiresEvenOnAuthFailure()
    {
        var pipeline = new QueryPipeline();
        var tracker = new LifecycleTracker();
        pipeline.Use(tracker);
        pipeline.RegisterAuthorization(a => throw new InvalidOperationException("denied"));

        var args = MakeArgs(authTags: ["admin"]);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => pipeline.ExecuteAsync(args, () => Task.FromResult("ok")));

        Assert.Contains("Init", tracker.Calls);
        Assert.Contains("End", tracker.Calls);
        Assert.DoesNotContain("Before", tracker.Calls);
    }

    [Fact]
    public async Task ExecuteAsync_SkipsAuthWhenNoTags()
    {
        var pipeline = new QueryPipeline();
        var authCalled = false;
        pipeline.RegisterAuthorization(_ => authCalled = true);

        var args = MakeArgs(authTags: []);
        await pipeline.ExecuteAsync(args, () => Task.FromResult(1));

        Assert.False(authCalled);
    }

    [Fact]
    public async Task ExecuteAsync_CheckPlugin_CanReject()
    {
        var pipeline = new QueryPipeline();
        pipeline.Use(new RejectingPlugin());

        var args = MakeArgs();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => pipeline.ExecuteAsync(args, () => Task.FromResult("ok")));

        Assert.Equal("rejected", ex.Message);
    }

    [Fact]
    public void CheckAuthorization_ThrowsWhenNoHooksButTaggedQueries()
    {
        var pipeline = new QueryPipeline();
        var queries = new[] { new QueryDefinition { Name = "delete", Authorization = ["admin"] } };

        var ex = Assert.Throws<InvalidOperationException>(() => pipeline.CheckAuthorization(queries));
        Assert.Contains("delete", ex.Message);
    }

    [Fact]
    public void CheckAuthorization_PassesWhenHookRegistered()
    {
        var pipeline = new QueryPipeline();
        pipeline.RegisterAuthorization(_ => { });
        var queries = new[] { new QueryDefinition { Name = "delete", Authorization = ["admin"] } };

        pipeline.CheckAuthorization(queries); // should not throw
    }

    [Fact]
    public async Task ExecuteAsync_EndArgs_ContainsDuration()
    {
        var pipeline = new QueryPipeline();
        var tracker = new LifecycleTracker();
        pipeline.Use(tracker);

        var args = MakeArgs();
        await pipeline.ExecuteAsync(args, async () => { await Task.Delay(10); return 1; });

        Assert.NotNull(tracker.LastEndArgs);
        Assert.True(tracker.LastEndArgs!.DurationMs >= 0);
        Assert.Null(tracker.LastEndArgs.Error);
    }

    [Fact]
    public async Task ExecuteAsync_EndArgs_ContainsErrorOnFailure()
    {
        var pipeline = new QueryPipeline();
        var tracker = new LifecycleTracker();
        pipeline.Use(tracker);

        var args = MakeArgs();
        await Assert.ThrowsAsync<Exception>(
            () => pipeline.ExecuteAsync<int>(args, () => throw new Exception("boom")));

        Assert.NotNull(tracker.LastEndArgs);
        Assert.NotNull(tracker.LastEndArgs!.Error);
        Assert.Equal("boom", tracker.LastEndArgs.Error!.Message);
    }

    private static PipelineExecutionArgs MakeArgs(List<string>? authTags = null) => new()
    {
        Hash = "abc123",
        Name = "testQuery",
        Location = "test.ts:1:1",
        Query = new QueryDefinition
        {
            Name = "testQuery",
            Hash = "abc123",
            Authorization = authTags ?? [],
        },
        Params = new(),
        Context = new(),
    };

    private sealed class LifecycleTracker : IQueryPipelinePlugin
    {
        public string Name => "tracker";
        public List<string> Calls { get; } = new();
        public PipelineEndArgs? LastEndArgs { get; private set; }

        public void Init(PipelineExecutionArgs args) => Calls.Add("Init");
        public Task CheckAsync(PipelineExecutionArgs args) { Calls.Add("Check"); return Task.CompletedTask; }
        public void Before(PipelineExecutionArgs args) => Calls.Add("Before");
        public void End(PipelineEndArgs args) { Calls.Add("End"); LastEndArgs = args; }
        public void OnError(Exception error, PipelineExecutionArgs args) => Calls.Add("OnError");
    }

    private sealed class RejectingPlugin : IQueryPipelinePlugin
    {
        public string Name => "rejecter";
        public Task CheckAsync(PipelineExecutionArgs args) => throw new InvalidOperationException("rejected");
    }
}

public class QueryRegistryAuthorizationTests
{
    [Fact]
    public void GetAuthorizedQueries_ReturnsTaggedOnly()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1, Queries = new()
            {
                ["h1"] = new QueryDefinition { Name = "public", Authorization = [] },
                ["h2"] = new QueryDefinition { Name = "admin", Authorization = ["admin"] },
            }
        });

        var authorized = registry.GetAuthorizedQueries().ToList();
        Assert.Single(authorized);
        Assert.Equal("admin", authorized[0].Name);
    }

    [Fact]
    public void GetUnauthorizedQueries_ReturnsUntaggedOnly()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1, Queries = new()
            {
                ["h1"] = new QueryDefinition { Name = "public", Authorization = [] },
                ["h2"] = new QueryDefinition { Name = "admin", Authorization = ["admin"] },
            }
        });

        var unauth = registry.GetUnauthorizedQueries().ToList();
        Assert.Single(unauth);
        Assert.Equal("public", unauth[0].Name);
    }

    [Fact]
    public void CheckAuthorization_ThrowsWhenMissingHooks()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1, Queries = new()
            {
                ["h1"] = new QueryDefinition { Name = "delete", Authorization = ["admin"] },
            }
        });

        Assert.Throws<InvalidOperationException>(() => registry.CheckAuthorization());
    }

    [Fact]
    public void CheckAuthorization_PassesWithHook()
    {
        var registry = new QueryRegistry("postgresql");
        registry.RegisterAuthorization(_ => { });
        registry.Load(new QueryManifest
        {
            Version = 1, Queries = new()
            {
                ["h1"] = new QueryDefinition { Name = "delete", Authorization = ["admin"] },
            }
        });

        registry.CheckAuthorization(); // no throw
    }
}

public class ContextInjectionTests
{
    [Fact]
    public async Task ExecuteAsync_InjectsContextParams()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1, Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "myOrders",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT * WHERE user_id = " }, new ParamNode { Name = "userId" } },
                    Params = new() { ["userId"] = new ParamDefinition { Name = "userId", IsContext = true } },
                }
            }
        });

        SqlBuildResult? captured = null;
        await registry.ExecuteAsync("h1", new(), new() { ["userId"] = "user-42" },
            sql => { captured = sql; return Task.FromResult(new List<Dictionary<string, object?>>()); });

        Assert.NotNull(captured);
        Assert.Contains("user-42", captured!.Values.Select(v => v?.ToString()));
    }

    [Fact]
    public async Task ExecuteAsync_ThrowsWhenContextMissing()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1, Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "myOrders",
                    Hash = "h1",
                    Template = { new TextNode { Value = "SELECT 1" } },
                    Params = new() { ["userId"] = new ParamDefinition { Name = "userId", IsContext = true } },
                }
            }
        });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => registry.ExecuteAsync("h1", new(), new(),
                sql => Task.FromResult(new List<Dictionary<string, object?>>())));

        Assert.Contains("userId", ex.Message);
        Assert.Contains("not provided", ex.Message);
    }
}
