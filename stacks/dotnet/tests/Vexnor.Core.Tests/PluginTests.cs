using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

public class RateLimiterPluginTests
{
    [Fact]
    public async Task RejectsWhenMaxConcurrentExceeded()
    {
        var plugin = new RateLimiterPlugin(new RateLimiterOptions { MaxConcurrent = 1 });
        var args = MakeArgs("q1");

        plugin.Init(args); // in-flight = 1
        plugin.Init(args); // in-flight = 2

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => plugin.CheckAsync(args));
        Assert.Contains("Rate limited", ex.Message);
        Assert.Contains("testQuery", ex.Message);
    }

    [Fact]
    public async Task AllowsWithinMaxConcurrent()
    {
        var plugin = new RateLimiterPlugin(new RateLimiterOptions { MaxConcurrent = 2 });
        var args = MakeArgs("q1");

        plugin.Init(args);
        plugin.Init(args);

        await plugin.CheckAsync(args); // should not throw
    }

    [Fact]
    public async Task DecrementsOnEnd()
    {
        var plugin = new RateLimiterPlugin(new RateLimiterOptions { MaxConcurrent = 1 });
        var args = MakeArgs("q1");

        plugin.Init(args);
        plugin.End(new PipelineEndArgs { Execution = args, DurationMs = 10, Error = null });
        plugin.Init(args); // should be fine — back to 1

        await plugin.CheckAsync(args); // should not throw
    }

    [Fact]
    public async Task RejectsPerContextWhenExceeded()
    {
        var plugin = new RateLimiterPlugin(new RateLimiterOptions
        {
            MaxConcurrentPerContext = 1,
            ContextKeyResolver = ctx => ctx["userId"]?.ToString() ?? "",
        });

        var args = MakeArgs("q1", ctx: new() { ["userId"] = "user-1" });

        plugin.Init(args);
        plugin.Init(args); // user-1 in-flight = 2

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => plugin.CheckAsync(args));
        Assert.Contains("Rate limited", ex.Message);
        Assert.Contains("user-1", ex.Message);
    }

    [Fact]
    public async Task DifferentContextKeysAreIndependent()
    {
        var plugin = new RateLimiterPlugin(new RateLimiterOptions
        {
            MaxConcurrentPerContext = 1,
            ContextKeyResolver = ctx => ctx["userId"]?.ToString() ?? "",
        });

        var args1 = MakeArgs("q1", ctx: new() { ["userId"] = "user-1" });
        var args2 = MakeArgs("q1", ctx: new() { ["userId"] = "user-2" });

        plugin.Init(args1);
        plugin.Init(args2);

        await plugin.CheckAsync(args1); // each user has 1 — within limit
        await plugin.CheckAsync(args2);
    }

    private static PipelineExecutionArgs MakeArgs(string hash, Dictionary<string, object?>? ctx = null) => new()
    {
        Hash = hash,
        Name = "testQuery",
        Location = null,
        Query = new QueryDefinition { Name = "testQuery", Hash = hash },
        Params = new(),
        Context = ctx ?? new(),
    };
}

public class AuditLogPluginTests
{
    [Fact]
    public void End_EmitsLogEntry()
    {
        AuditLogEntry? logged = null;
        var plugin = new AuditLogPlugin(new AuditLogOptions { OnLog = e => logged = e });

        var args = new PipelineEndArgs
        {
            Execution = MakeArgs(),
            DurationMs = 42,
            Error = null,
        };

        plugin.End(args);

        Assert.NotNull(logged);
        Assert.Equal("testQuery", logged!.Name);
        Assert.Equal("abc", logged.Hash);
        Assert.Equal(42, logged.DurationMs);
        Assert.Null(logged.Error);
        Assert.Null(logged.Context);
    }

    [Fact]
    public void End_LogsErrorMessage()
    {
        AuditLogEntry? logged = null;
        var plugin = new AuditLogPlugin(new AuditLogOptions { OnLog = e => logged = e });

        var args = new PipelineEndArgs
        {
            Execution = MakeArgs(),
            DurationMs = 5,
            Error = new Exception("boom"),
        };

        plugin.End(args);

        Assert.Equal("boom", logged!.Error);
    }

    [Fact]
    public void End_ProjectsContextViaResolver()
    {
        AuditLogEntry? logged = null;
        var plugin = new AuditLogPlugin(new AuditLogOptions
        {
            ContextLogResolver = ctx => new() { ["userId"] = ctx["userId"] },
            OnLog = e => logged = e,
        });

        var args = new PipelineEndArgs
        {
            Execution = MakeArgs(ctx: new() { ["userId"] = "u-1", ["secret"] = "s3cret" }),
            DurationMs = 1,
            Error = null,
        };

        plugin.End(args);

        Assert.NotNull(logged!.Context);
        Assert.Equal("u-1", logged.Context!["userId"]);
        Assert.False(logged.Context.ContainsKey("secret"));
    }

    [Fact]
    public void End_OmitsContextWhenNoResolver()
    {
        AuditLogEntry? logged = null;
        var plugin = new AuditLogPlugin(new AuditLogOptions { OnLog = e => logged = e });

        var args = new PipelineEndArgs
        {
            Execution = MakeArgs(ctx: new() { ["secret"] = "s3cret" }),
            DurationMs = 1,
            Error = null,
        };

        plugin.End(args);

        Assert.Null(logged!.Context); // raw context never leaked
    }

    private static PipelineExecutionArgs MakeArgs(Dictionary<string, object?>? ctx = null) => new()
    {
        Hash = "abc",
        Name = "testQuery",
        Location = "file.ts:1:1",
        Query = new QueryDefinition { Name = "testQuery", Hash = "abc" },
        Params = new(),
        Context = ctx ?? new(),
    };
}

public class RateLimiterPluginAdditionalTests
{
    [Fact]
    public void Name_ReturnsConfiguredName()
    {
        var plugin = new RateLimiterPlugin(new RateLimiterOptions { Name = "MyLimiter" });
        Assert.Equal("MyLimiter", plugin.Name);
    }

    [Fact]
    public async Task End_DecrementsContextInFlight()
    {
        var plugin = new RateLimiterPlugin(new RateLimiterOptions
        {
            MaxConcurrentPerContext = 1,
            ContextKeyResolver = ctx => ctx["userId"]?.ToString() ?? "",
        });

        var args = MakeArgs("q1", ctx: new() { ["userId"] = "user-1" });
        plugin.Init(args);
        plugin.End(new PipelineEndArgs { Execution = args, DurationMs = 1, Error = null });

        // Should allow again after End decremented
        plugin.Init(args);
        await plugin.CheckAsync(args); // should not throw — back to 1
    }

    private static PipelineExecutionArgs MakeArgs(string hash, Dictionary<string, object?>? ctx = null) => new()
    {
        Hash = hash,
        Name = "testQuery",
        Location = null,
        Query = new QueryDefinition { Name = "testQuery", Hash = hash },
        Params = new(),
        Context = ctx ?? new(),
    };
}

public class QueryPipelineAdditionalTests
{
    [Fact]
    public void CheckAuthorization_PassesWhenNoTaggedQueries()
    {
        var pipeline = new QueryPipeline();
        var queries = new[] { new QueryDefinition { Name = "public", Authorization = [] } };

        pipeline.CheckAuthorization(queries); // no throw — no hooks needed when no tags
    }

    [Fact]
    public async Task ExecuteAsync_CallsOnErrorWhenInitThrows()
    {
        var pipeline = new QueryPipeline();
        var plugin = new ThrowingInitPlugin();
        pipeline.Use(plugin);

        var args = MakeArgs();
        // Init throws but execution still proceeds (error is swallowed via SafeOnError)
        var result = await pipeline.ExecuteAsync(args, () => Task.FromResult("ok"));

        Assert.Equal("ok", result);
        Assert.True(plugin.OnErrorCalled);
    }

    [Fact]
    public async Task ExecuteAsync_CallsOnErrorWhenEndThrows()
    {
        var pipeline = new QueryPipeline();
        var plugin = new ThrowingEndPlugin();
        pipeline.Use(plugin);

        var args = MakeArgs();
        var result = await pipeline.ExecuteAsync(args, () => Task.FromResult("ok"));

        Assert.Equal("ok", result);
        Assert.True(plugin.OnErrorCalled);
    }

    private static PipelineExecutionArgs MakeArgs() => new()
    {
        Hash = "abc",
        Name = "test",
        Location = null,
        Query = new QueryDefinition { Name = "test", Hash = "abc" },
        Params = new(),
        Context = new(),
    };

    private sealed class ThrowingInitPlugin : IQueryPipelinePlugin
    {
        public string Name => "thrower";
        public bool OnErrorCalled { get; private set; }
        public void Init(PipelineExecutionArgs args) => throw new Exception("init boom");
        public void OnError(Exception error, PipelineExecutionArgs args) => OnErrorCalled = true;
    }

    private sealed class ThrowingEndPlugin : IQueryPipelinePlugin
    {
        public string Name => "thrower";
        public bool OnErrorCalled { get; private set; }
        public void End(PipelineEndArgs args) => throw new Exception("end boom");
        public void OnError(Exception error, PipelineExecutionArgs args) => OnErrorCalled = true;
    }
}

public class AuditLogPluginAdditionalTests
{
    [Fact]
    public void Name_ReturnsDefault()
    {
        var plugin = new AuditLogPlugin(new AuditLogOptions { OnLog = _ => { } });
        Assert.Equal("AuditLogPlugin", plugin.Name);
    }

    [Fact]
    public void Name_ReturnsCustom()
    {
        var plugin = new AuditLogPlugin(new AuditLogOptions { Name = "MyAudit", OnLog = _ => { } });
        Assert.Equal("MyAudit", plugin.Name);
    }
}

public class QueryRegistryAdditionalTests
{
    [Fact]
    public void Use_RegistersPlugin()
    {
        var registry = new QueryRegistry("postgresql");
        var plugin = new TrackingPlugin();
        registry.Use(plugin);
        registry.Load(new QueryManifest
        {
            Version = 1, Queries = new()
            {
                ["h1"] = new QueryDefinition
                {
                    Name = "test", Hash = "h1",
                    Template = { new TextNode { Value = "SELECT 1" } },
                }
            }
        });

        registry.ExecuteAsync("h1", new(), new(),
            _ => Task.FromResult(new List<Dictionary<string, object?>>())).Wait();

        Assert.True(plugin.InitCalled);
    }

    [Fact]
    public void GetRegisteredHashes_ReturnsHashes()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1, Queries = new()
            {
                ["h1"] = new QueryDefinition { Name = "a" },
                ["h2"] = new QueryDefinition { Name = "b" },
            }
        });

        var hashes = registry.GetRegisteredHashes();
        Assert.Equal(2, hashes.Count);
        Assert.Contains("h1", hashes);
    }

    [Fact]
    public void GetQuery_ReturnsNullForUnknown()
    {
        var registry = new QueryRegistry("postgresql");
        Assert.Null(registry.GetQuery("nonexistent"));
    }

    [Fact]
    public void GetQuery_ReturnsDefinition()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1, Queries = new()
            {
                ["h1"] = new QueryDefinition { Name = "test", Hash = "h1" },
            }
        });

        var q = registry.GetQuery("h1");
        Assert.NotNull(q);
        Assert.Equal("test", q!.Name);
    }

    [Fact]
    public void GetRegisteredQueries_ReturnsAll()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(new QueryManifest
        {
            Version = 1, Queries = new()
            {
                ["h1"] = new QueryDefinition { Name = "a", Hash = "h1" },
                ["h2"] = new QueryDefinition { Name = "b", Hash = "h2" },
            }
        });

        var all = registry.GetRegisteredQueries().ToList();
        Assert.Equal(2, all.Count);
    }

    private sealed class TrackingPlugin : IQueryPipelinePlugin
    {
        public string Name => "tracker";
        public bool InitCalled { get; private set; }
        public void Init(PipelineExecutionArgs args) => InitCalled = true;
    }
}

public class QueryPipelineBeforeThrowTests
{
    [Fact]
    public async Task ExecuteAsync_BeforeThrow_CallsOnError()
    {
        var pipeline = new QueryPipeline();
        var plugin = new ThrowingBeforePlugin();
        pipeline.Use(plugin);

        var args = new PipelineExecutionArgs
        {
            Hash = "x", Name = "test", Location = null,
            Query = new QueryDefinition { Name = "test", Hash = "x" },
            Params = new(), Context = new(),
        };

        // Before throws but is caught by SafeOnError — execution still proceeds
        var result = await pipeline.ExecuteAsync(args, () => Task.FromResult("ok"));
        Assert.Equal("ok", result);
        Assert.True(plugin.OnErrorCalled);
    }

    private sealed class ThrowingBeforePlugin : IQueryPipelinePlugin
    {
        public string Name => "before-thrower";
        public bool OnErrorCalled { get; private set; }
        public void Before(PipelineExecutionArgs args) => throw new Exception("before boom");
        public void OnError(Exception error, PipelineExecutionArgs args) => OnErrorCalled = true;
    }
}
