using System.Diagnostics;
using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

/// <summary>
/// Tests for OpenTelemetryPlugin Init/End/OnError lifecycle methods directly,
/// covering branches not reached by integration tests.
/// </summary>
public class OpenTelemetryPluginLifecycleTests
{
    private static readonly ActivitySource TestSource = new("vexnor.otel.lifecycle.tests");

    [Fact]
    public void Init_WithNoListener_DoesNotThrow()
    {
        // No ActivityListener registered — activity will be null, Init should silently no-op
        var plugin = new OpenTelemetryPlugin(new ActivitySource("no-listener-source"));
        var args = MakeArgs("query1");

        // Should not throw — exercises the early return path when activity is null
        plugin.Init(args);
    }

    [Fact]
    public void End_WithNoListener_DoesNotThrow()
    {
        // No activity was started (no listener), so End should gracefully handle null activity
        var plugin = new OpenTelemetryPlugin(new ActivitySource("no-listener-source-2"));
        var args = MakeArgs("query2");

        plugin.Init(args);
        plugin.End(new PipelineEndArgs
        {
            Execution = args,
            DurationMs = 50,
            Error = null,
        });
    }

    [Fact]
    public void OnError_WithNoActivity_DoesNotThrow()
    {
        // No listener → no activity → OnError should not throw
        var plugin = new OpenTelemetryPlugin(new ActivitySource("no-listener-source-3"));
        var args = MakeArgs("query3");

        plugin.Init(args);
        plugin.OnError(new Exception("test error"), args);
    }

    [Fact]
    public void OnError_WithActivity_AddsExceptionEvent()
    {
        using var listener = new ActivityListener
        {
            ShouldListenTo = _ => true,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
        };
        ActivitySource.AddActivityListener(listener);

        var plugin = new OpenTelemetryPlugin(TestSource);
        var args = MakeArgs("errorQuery");

        plugin.Init(args);
        plugin.OnError(new InvalidOperationException("db timeout"), args);

        // End disposes the activity, capturing it for assertion
        Activity? captured = null;
        listener.ActivityStopped = a => captured = a;

        plugin.End(new PipelineEndArgs
        {
            Execution = args,
            DurationMs = 100,
            Error = new InvalidOperationException("db timeout"),
        });

        Assert.NotNull(captured);
        var exEvent = captured!.Events.FirstOrDefault(e => e.Name == "exception");
        Assert.Equal("exception", exEvent.Name);
        Assert.Equal(typeof(InvalidOperationException).FullName,
            exEvent.Tags.FirstOrDefault(t => t.Key == "exception.type").Value);
        Assert.Equal("db timeout",
            exEvent.Tags.FirstOrDefault(t => t.Key == "exception.message").Value);
    }

    [Fact]
    public void End_WithError_SetsErrorStatusAndTags()
    {
        using var listener = new ActivityListener
        {
            ShouldListenTo = _ => true,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
        };
        ActivitySource.AddActivityListener(listener);

        Activity? captured = null;
        listener.ActivityStopped = a => captured = a;

        var plugin = new OpenTelemetryPlugin(TestSource);
        var args = MakeArgs("errorEndQuery");

        plugin.Init(args);
        plugin.End(new PipelineEndArgs
        {
            Execution = args,
            DurationMs = 200,
            Error = new ArgumentException("bad arg"),
        });

        Assert.NotNull(captured);
        Assert.Equal(ActivityStatusCode.Error, captured!.Status);
        Assert.Equal("bad arg", captured.StatusDescription);
        Assert.Equal(true, captured.GetTagItem("error"));
        Assert.Equal("bad arg", captured.GetTagItem("error.message"));
        Assert.Equal("ArgumentException", captured.GetTagItem("error.type"));
    }

    [Fact]
    public void End_Success_SetsOkStatus()
    {
        using var listener = new ActivityListener
        {
            ShouldListenTo = _ => true,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
        };
        ActivitySource.AddActivityListener(listener);

        Activity? captured = null;
        listener.ActivityStopped = a => captured = a;

        var plugin = new OpenTelemetryPlugin(TestSource);
        var args = MakeArgs("successQuery");

        plugin.Init(args);
        plugin.End(new PipelineEndArgs
        {
            Execution = args,
            DurationMs = 10,
            Error = null,
        });

        Assert.NotNull(captured);
        Assert.Equal(ActivityStatusCode.Ok, captured!.Status);
    }

    [Fact]
    public void Init_SetsAllTags_IncludingLocation()
    {
        using var listener = new ActivityListener
        {
            ShouldListenTo = _ => true,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
        };
        ActivitySource.AddActivityListener(listener);

        Activity? captured = null;
        listener.ActivityStopped = a => captured = a;

        var plugin = new OpenTelemetryPlugin(TestSource);
        var args = MakeArgs("tagQuery", hash: "h123", location: "src/queries.ts:42:5");

        plugin.Init(args);
        plugin.End(new PipelineEndArgs { Execution = args, DurationMs = 1, Error = null });

        Assert.Equal("sql", captured!.GetTagItem("db.system"));
        Assert.Equal("query", captured.GetTagItem("db.operation"));
        Assert.Equal("tagQuery", captured.GetTagItem("vexnor.query.name"));
        Assert.Equal("h123", captured.GetTagItem("vexnor.query.hash"));
        Assert.Equal("src/queries.ts:42:5", captured.GetTagItem("vexnor.query.location"));
    }

    [Fact]
    public void Init_WithoutLocation_DoesNotSetLocationTag()
    {
        using var listener = new ActivityListener
        {
            ShouldListenTo = _ => true,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
        };
        ActivitySource.AddActivityListener(listener);

        Activity? captured = null;
        listener.ActivityStopped = a => captured = a;

        var plugin = new OpenTelemetryPlugin(TestSource);
        var args = MakeArgs("noLocQuery", location: null);

        plugin.Init(args);
        plugin.End(new PipelineEndArgs { Execution = args, DurationMs = 1, Error = null });

        Assert.Null(captured!.GetTagItem("vexnor.query.location"));
    }

    [Fact]
    public void StringConstructor_CreatesInternalActivitySource()
    {
        var plugin = new OpenTelemetryPlugin("my-service");
        Assert.Equal("OpenTelemetryPlugin", plugin.Name);
    }

    [Fact]
    public void CustomName_IsUsed()
    {
        var plugin = new OpenTelemetryPlugin(TestSource, name: "CustomOTel");
        Assert.Equal("CustomOTel", plugin.Name);
    }

    [Fact]
    public void End_SetsDurationTag()
    {
        using var listener = new ActivityListener
        {
            ShouldListenTo = _ => true,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
        };
        ActivitySource.AddActivityListener(listener);

        Activity? captured = null;
        listener.ActivityStopped = a => captured = a;

        var plugin = new OpenTelemetryPlugin(TestSource);
        var args = MakeArgs("durationQuery");

        plugin.Init(args);
        plugin.End(new PipelineEndArgs { Execution = args, DurationMs = 42, Error = null });

        Assert.Equal(42L, captured!.GetTagItem("vexnor.query.duration_ms"));
    }

    private static PipelineExecutionArgs MakeArgs(string name, string? hash = null, string? location = "test:1:1") => new()
    {
        Hash = hash ?? "hash_" + name,
        Name = name,
        Location = location,
        Query = new QueryDefinition { Name = name, Hash = hash ?? "hash_" + name },
        Params = new(),
        Context = new(),
    };
}
