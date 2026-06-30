using System.Diagnostics;

namespace Vexnor.Core.Execution;

/// <summary>
/// OpenTelemetry plugin — creates an Activity (span) per query execution.
/// Uses System.Diagnostics.ActivitySource for native .NET OpenTelemetry support.
/// </summary>
public sealed class OpenTelemetryPlugin : IQueryPipelinePlugin
{
    private readonly ActivitySource _activitySource;
    private readonly AsyncLocal<Activity?> _currentActivity = new();

    public string Name { get; }

    public OpenTelemetryPlugin(ActivitySource activitySource, string? name = null)
    {
        _activitySource = activitySource;
        Name = name ?? "OpenTelemetryPlugin";
    }

    /// <summary>
    /// Convenience constructor — creates an ActivitySource with the given name.
    /// </summary>
    public OpenTelemetryPlugin(string serviceName)
        : this(new ActivitySource(serviceName))
    {
    }

    public void Init(PipelineExecutionArgs args)
    {
        var activity = _activitySource.StartActivity($"query:{args.Name}", ActivityKind.Client);
        if (activity == null) return;

        activity.SetTag("db.system", "sql");
        activity.SetTag("db.operation", "query");
        activity.SetTag("vexnor.query.name", args.Name);
        activity.SetTag("vexnor.query.hash", args.Hash);

        if (args.Location != null)
            activity.SetTag("vexnor.query.location", args.Location);

        _currentActivity.Value = activity;
    }

    public void End(PipelineEndArgs args)
    {
        var activity = _currentActivity.Value;
        if (activity == null) return;

        activity.SetTag("vexnor.query.duration_ms", args.DurationMs);

        if (args.Error != null)
        {
            activity.SetStatus(ActivityStatusCode.Error, args.Error.Message);
            activity.SetTag("error", true);
            activity.SetTag("error.message", args.Error.Message);
            activity.SetTag("error.type", args.Error.GetType().Name);
        }
        else
        {
            activity.SetStatus(ActivityStatusCode.Ok);
        }

        activity.Dispose();
        _currentActivity.Value = null;
    }

    public void OnError(Exception error, PipelineExecutionArgs args)
    {
        var activity = _currentActivity.Value;
        activity?.AddEvent(new ActivityEvent("exception", tags: new ActivityTagsCollection
        {
            ["exception.type"] = error.GetType().FullName,
            ["exception.message"] = error.Message,
        }));
    }
}
