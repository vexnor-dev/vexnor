using System.Diagnostics;
using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

public class OpenTelemetryPluginTests
{
    private static readonly ActivitySource TestSource = new("vexnor.tests");

    [Fact]
    public async Task Creates_Activity_Per_Query()
    {
        using var listener = new ActivityListener
        {
            ShouldListenTo = _ => true,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
        };
        ActivitySource.AddActivityListener(listener);

        var pipeline = new QueryPipeline();
        var plugin = new OpenTelemetryPlugin(TestSource);
        pipeline.Use(plugin);

        Activity? captured = null;
        listener.ActivityStopped = a => captured = a;

        var args = MakeArgs("selectAccounts");
        await pipeline.ExecuteAsync(args, () => Task.FromResult("ok"));

        Assert.NotNull(captured);
        Assert.Equal("query:selectAccounts", captured!.OperationName);
        Assert.Equal(ActivityStatusCode.Ok, captured.Status);
    }

    [Fact]
    public async Task Tags_Include_QueryName_And_Hash()
    {
        using var listener = new ActivityListener
        {
            ShouldListenTo = _ => true,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
        };
        ActivitySource.AddActivityListener(listener);

        var pipeline = new QueryPipeline();
        pipeline.Use(new OpenTelemetryPlugin(TestSource));

        Activity? captured = null;
        listener.ActivityStopped = a => captured = a;

        var args = MakeArgs("myQuery", hash: "abc123", location: "file.ts:10:5");
        await pipeline.ExecuteAsync(args, () => Task.FromResult(1));

        Assert.Equal("myQuery", captured!.GetTagItem("vexnor.query.name"));
        Assert.Equal("abc123", captured.GetTagItem("vexnor.query.hash"));
        Assert.Equal("file.ts:10:5", captured.GetTagItem("vexnor.query.location"));
    }

    [Fact]
    public async Task Error_Sets_Status_And_Tags()
    {
        using var listener = new ActivityListener
        {
            ShouldListenTo = _ => true,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
        };
        ActivitySource.AddActivityListener(listener);

        var pipeline = new QueryPipeline();
        pipeline.Use(new OpenTelemetryPlugin(TestSource));

        Activity? captured = null;
        listener.ActivityStopped = a => captured = a;

        var args = MakeArgs("failQuery");
        await Assert.ThrowsAsync<Exception>(() =>
            pipeline.ExecuteAsync<int>(args, () => throw new Exception("db timeout")));

        Assert.Equal(ActivityStatusCode.Error, captured!.Status);
        Assert.Equal("db timeout", captured.StatusDescription);
        Assert.Equal(true, captured.GetTagItem("error"));
    }

    [Fact]
    public async Task Duration_Tag_Is_Set()
    {
        using var listener = new ActivityListener
        {
            ShouldListenTo = _ => true,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
        };
        ActivitySource.AddActivityListener(listener);

        var pipeline = new QueryPipeline();
        pipeline.Use(new OpenTelemetryPlugin(TestSource));

        Activity? captured = null;
        listener.ActivityStopped = a => captured = a;

        var args = MakeArgs("slowQuery");
        await pipeline.ExecuteAsync(args, async () => { await Task.Delay(15); return 1; });

        var durationMs = (long?)captured!.GetTagItem("vexnor.query.duration_ms");
        Assert.NotNull(durationMs);
        Assert.True(durationMs >= 10);
    }

    private static PipelineExecutionArgs MakeArgs(string name, string? hash = null, string? location = null) => new()
    {
        Hash = hash ?? "hash_" + name,
        Name = name,
        Location = location,
        Query = new QueryDefinition { Name = name, Hash = hash ?? "hash_" + name },
        Params = new(),
        Context = new(),
    };
}
