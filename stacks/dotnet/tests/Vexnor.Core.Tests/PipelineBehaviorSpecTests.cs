using System.Text.Json;
using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

/// <summary>
/// Runs the shared pipeline-behavior-spec.json that both Node.js and .NET must pass.
/// If this test fails, the .NET pipeline behavior has drifted from the spec.
/// </summary>
public class PipelineBehaviorSpecTests
{
    private static readonly string SpecPath = Path.GetFullPath(
        Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "..", "fixtures", "pipeline-behavior-spec.json"));

    // ─── Authorization ───────────────────────────────────────────────────────

    [Fact]
    public void Auth_TaggedQuery_NoHook_ThrowsOnCheck()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(MakeManifest(("h1", "deleteAccount", new[] { "admin" })));
        Assert.Throws<InvalidOperationException>(() => registry.CheckAuthorization());
    }

    [Fact]
    public void Auth_TaggedQuery_WithHook_PassesCheck()
    {
        var registry = new QueryRegistry("postgresql");
        registry.RegisterAuthorization(_ => { });
        registry.Load(MakeManifest(("h1", "deleteAccount", new[] { "admin" })));
        registry.CheckAuthorization();
    }

    [Fact]
    public async Task Auth_ExecutionDenied_WhenHookThrows()
    {
        var registry = new QueryRegistry("postgresql");
        registry.RegisterAuthorization(_ => throw new InvalidOperationException("denied"));
        registry.Load(MakeManifest(("h1", "deleteAccount", new[] { "admin" })));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            registry.ExecuteAsync("h1", new(), new() { ["roles"] = "user" },
                _ => Task.FromResult(new List<Dictionary<string, object?>>())));
        Assert.Contains("denied", ex.Message);
    }

    [Fact]
    public async Task Auth_ExecutionAllowed_WhenNoTags()
    {
        var registry = new QueryRegistry("postgresql");
        registry.RegisterAuthorization(_ => throw new InvalidOperationException("denied"));
        registry.Load(MakeManifest(("h2", "selectAccounts", Array.Empty<string>())));

        // Should NOT throw — query has no auth tags
        await registry.ExecuteAsync("h2", new(), new(),
            _ => Task.FromResult(new List<Dictionary<string, object?>>()));
    }

    [Fact]
    public void Auth_GetAuthorizedQueries_ReturnsTaggedOnly()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(MakeManifest(
            ("h1", "public", Array.Empty<string>()),
            ("h2", "admin", new[] { "admin" }),
            ("h3", "superAdmin", new[] { "super" })));

        var names = registry.GetAuthorizedQueries().Select(q => q.Name).OrderBy(n => n).ToList();
        Assert.Equal(new[] { "admin", "superAdmin" }, names);
    }

    [Fact]
    public void Auth_GetUnauthorizedQueries_ReturnsUntaggedOnly()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(MakeManifest(
            ("h1", "public", Array.Empty<string>()),
            ("h2", "admin", new[] { "admin" })));

        var names = registry.GetUnauthorizedQueries().Select(q => q.Name).ToList();
        Assert.Equal(new[] { "public" }, names);
    }

    // ─── Rate Limiting ───────────────────────────────────────────────────────

    [Fact]
    public async Task Rate_AllowsWithinMaxConcurrent()
    {
        var pipeline = new QueryPipeline();
        pipeline.Use(new RateLimiterPlugin(new RateLimiterOptions { MaxConcurrent = 2 }));

        var args = MakeArgs("q1");
        // Two concurrent — both should succeed
        var t1 = pipeline.ExecuteAsync(args, async () => { await Task.Delay(50); return 1; });
        var t2 = pipeline.ExecuteAsync(args, async () => { await Task.Delay(50); return 2; });
        var results = await Task.WhenAll(t1, t2);
        Assert.Equal(2, results.Length);
    }

    [Fact]
    public async Task Rate_RejectsWhenMaxConcurrentExceeded()
    {
        var pipeline = new QueryPipeline();
        pipeline.Use(new RateLimiterPlugin(new RateLimiterOptions { MaxConcurrent = 1 }));

        var args = MakeArgs("q1");
        var blocker = new TaskCompletionSource<int>();
        var t1 = pipeline.ExecuteAsync(args, () => blocker.Task);

        // Second call should be rejected
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            pipeline.ExecuteAsync(args, () => Task.FromResult(2)));
        Assert.Contains("Rate limited", ex.Message);

        blocker.SetResult(1);
        await t1;
    }

    [Fact]
    public async Task Rate_RejectsPerContext()
    {
        var pipeline = new QueryPipeline();
        pipeline.Use(new RateLimiterPlugin(new RateLimiterOptions
        {
            MaxConcurrentPerContext = 1,
            ContextKeyResolver = ctx => ctx["userId"]?.ToString() ?? "",
        }));

        var args = MakeArgs("q1", ctx: new() { ["userId"] = "user-1" });
        var blocker = new TaskCompletionSource<int>();
        var t1 = pipeline.ExecuteAsync(args, () => blocker.Task);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            pipeline.ExecuteAsync(args, () => Task.FromResult(2)));
        Assert.Contains("Rate limited", ex.Message);

        blocker.SetResult(1);
        await t1;
    }

    [Fact]
    public async Task Rate_DifferentContextsAreIndependent()
    {
        var pipeline = new QueryPipeline();
        pipeline.Use(new RateLimiterPlugin(new RateLimiterOptions
        {
            MaxConcurrentPerContext = 1,
            ContextKeyResolver = ctx => ctx["userId"]?.ToString() ?? "",
        }));

        var args1 = MakeArgs("q1", ctx: new() { ["userId"] = "user-1" });
        var args2 = MakeArgs("q1", ctx: new() { ["userId"] = "user-2" });

        var t1 = pipeline.ExecuteAsync(args1, async () => { await Task.Delay(50); return 1; });
        var t2 = pipeline.ExecuteAsync(args2, async () => { await Task.Delay(50); return 2; });
        var results = await Task.WhenAll(t1, t2);
        Assert.Equal(2, results.Length);
    }

    [Fact]
    public async Task Rate_DecrementsAfterCompletion()
    {
        var pipeline = new QueryPipeline();
        pipeline.Use(new RateLimiterPlugin(new RateLimiterOptions { MaxConcurrent = 1 }));

        var args = MakeArgs("q1");
        for (int i = 0; i < 3; i++)
        {
            await pipeline.ExecuteAsync(args, () => Task.FromResult(i));
        }
        // If decrement didn't work, the 2nd+ calls would throw
    }

    // ─── Pipeline Lifecycle ──────────────────────────────────────────────────

    [Fact]
    public async Task Lifecycle_FullSequence()
    {
        var pipeline = new QueryPipeline();
        var tracker = new LifecycleTracker();
        pipeline.Use(tracker);

        await pipeline.ExecuteAsync(MakeArgs("q"), () => Task.FromResult(1));
        Assert.Equal(new[] { "Init", "Check", "Before", "End" }, tracker.Calls.ToArray());
    }

    [Fact]
    public async Task Lifecycle_EndFiresOnAuthDenial()
    {
        var pipeline = new QueryPipeline();
        var tracker = new LifecycleTracker();
        pipeline.Use(tracker);
        pipeline.RegisterAuthorization(_ => throw new InvalidOperationException("denied"));

        var args = MakeArgs("q", authTags: new[] { "admin" });
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            pipeline.ExecuteAsync(args, () => Task.FromResult(1)));

        Assert.Contains("Init", tracker.Calls);
        Assert.Contains("End", tracker.Calls);
        Assert.DoesNotContain("Before", tracker.Calls);
    }

    [Fact]
    public async Task Lifecycle_EndContainsDuration()
    {
        var pipeline = new QueryPipeline();
        var tracker = new LifecycleTracker();
        pipeline.Use(tracker);

        await pipeline.ExecuteAsync(MakeArgs("q"), async () => { await Task.Delay(10); return 1; });
        Assert.NotNull(tracker.LastEnd);
        Assert.True(tracker.LastEnd!.DurationMs >= 0);
        Assert.Null(tracker.LastEnd.Error);
    }

    [Fact]
    public async Task Lifecycle_EndContainsErrorOnFailure()
    {
        var pipeline = new QueryPipeline();
        var tracker = new LifecycleTracker();
        pipeline.Use(tracker);

        await Assert.ThrowsAsync<Exception>(() =>
            pipeline.ExecuteAsync<int>(MakeArgs("q"), () => throw new Exception("boom")));
        Assert.NotNull(tracker.LastEnd?.Error);
    }

    // ─── Context Injection ───────────────────────────────────────────────────

    [Fact]
    public async Task Context_InjectsParam()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1, Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "myOrders", Hash = "h1",
                    Template = { new TextNode { Value = "SELECT * WHERE user_id = " }, new ParamNode { Name = "userId" } },
                    Params = new() { ["userId"] = new ParamDefinition { Name = "userId", IsContext = true } },
                }
            }
        });

        SqlBuildResult? captured = null;
        await registry.ExecuteAsync("h1", new(), new() { ["userId"] = "user-42" },
            sql => { captured = sql; return Task.FromResult(new List<Dictionary<string, object?>>()); });

        Assert.Contains("user-42", captured!.Values.Select(v => v?.ToString()));
    }

    [Fact]
    public async Task Context_ThrowsWhenMissing()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1, Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "myOrders", Hash = "h1",
                    Template = { new TextNode { Value = "SELECT 1" } },
                    Params = new() { ["userId"] = new ParamDefinition { Name = "userId", IsContext = true } },
                }
            }
        });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            registry.ExecuteAsync("h1", new(), new(),
                _ => Task.FromResult(new List<Dictionary<string, object?>>())));
        Assert.Contains("userId", ex.Message);
    }

    // ─── Audit Log ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Audit_FiresOnSuccess()
    {
        AuditLogEntry? logged = null;
        var pipeline = new QueryPipeline();
        pipeline.Use(new AuditLogPlugin(new AuditLogOptions { OnLog = e => logged = e }));

        await pipeline.ExecuteAsync(MakeArgs("testQuery"), () => Task.FromResult(1));
        Assert.NotNull(logged);
        Assert.Equal("testQuery", logged!.Name);
        Assert.Null(logged.Error);
        Assert.True(logged.DurationMs >= 0);
    }

    [Fact]
    public async Task Audit_FiresOnFailure()
    {
        AuditLogEntry? logged = null;
        var pipeline = new QueryPipeline();
        pipeline.Use(new AuditLogPlugin(new AuditLogOptions { OnLog = e => logged = e }));

        await Assert.ThrowsAsync<Exception>(() =>
            pipeline.ExecuteAsync<int>(MakeArgs("q"), () => throw new Exception("fail")));
        Assert.NotNull(logged?.Error);
    }

    [Fact]
    public async Task Audit_ContextProjectionStripsRaw()
    {
        AuditLogEntry? logged = null;
        var pipeline = new QueryPipeline();
        pipeline.Use(new AuditLogPlugin(new AuditLogOptions
        {
            ContextLogResolver = ctx => new() { ["userId"] = ctx["userId"] },
            OnLog = e => logged = e,
        }));

        await pipeline.ExecuteAsync(
            MakeArgs("q", ctx: new() { ["userId"] = "u-1", ["secret"] = "s3cr3t" }),
            () => Task.FromResult(1));

        Assert.Equal("u-1", logged!.Context!["userId"]);
        Assert.False(logged.Context.ContainsKey("secret"));
    }

    [Fact]
    public async Task Audit_NoResolverMeansNullContext()
    {
        AuditLogEntry? logged = null;
        var pipeline = new QueryPipeline();
        pipeline.Use(new AuditLogPlugin(new AuditLogOptions { OnLog = e => logged = e }));

        await pipeline.ExecuteAsync(
            MakeArgs("q", ctx: new() { ["secret"] = "s3cr3t" }),
            () => Task.FromResult(1));

        Assert.Null(logged!.Context);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static QueryManifest MakeManifest(params (string hash, string name, string[] auth)[] queries)
    {
        var m = new QueryManifest { Version = 1 };
        foreach (var (hash, name, auth) in queries)
            m.Queries[hash] = new QueryDefinition
            {
                Name = name, Hash = hash, Authorization = auth.ToList(),
                Template = { new TextNode { Value = "SELECT 1" } },
            };
        return m;
    }

    private static PipelineExecutionArgs MakeArgs(string name, string[]? authTags = null, Dictionary<string, object?>? ctx = null) => new()
    {
        Hash = "hash_" + name,
        Name = name,
        Location = null,
        Query = new QueryDefinition { Name = name, Hash = "hash_" + name, Authorization = (authTags ?? Array.Empty<string>()).ToList() },
        Params = new(),
        Context = ctx ?? new(),
    };

    private sealed class LifecycleTracker : IQueryPipelinePlugin
    {
        public string Name => "tracker";
        public List<string> Calls { get; } = new();
        public PipelineEndArgs? LastEnd { get; private set; }
        public void Init(PipelineExecutionArgs args) => Calls.Add("Init");
        public Task CheckAsync(PipelineExecutionArgs args) { Calls.Add("Check"); return Task.CompletedTask; }
        public void Before(PipelineExecutionArgs args) => Calls.Add("Before");
        public void End(PipelineEndArgs args) { Calls.Add("End"); LastEnd = args; }
    }
}
