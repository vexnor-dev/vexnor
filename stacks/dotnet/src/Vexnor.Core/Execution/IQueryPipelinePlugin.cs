using Vexnor.Core.Manifest;

namespace Vexnor.Core.Execution;

/// <summary>
/// Execution context passed through all pipeline lifecycle hooks.
/// </summary>
public sealed class PipelineExecutionArgs
{
    public required string Hash { get; init; }
    public required string Name { get; init; }
    public required string? Location { get; init; }
    public required QueryDefinition Query { get; init; }
    public required Dictionary<string, object?> Params { get; init; }
    public required Dictionary<string, object?> Context { get; init; }
}

/// <summary>
/// Args passed to End() after execution completes — success or failure.
/// </summary>
public sealed class PipelineEndArgs
{
    public required PipelineExecutionArgs Execution { get; init; }
    public required long DurationMs { get; init; }
    /// <summary>null on success.</summary>
    public required Exception? Error { get; init; }
}

/// <summary>
/// A composable plugin that plugs into the query pipeline.
///
/// Lifecycle flow: Init → Check → Before → [execute query] → End
///
/// Init/End always fire as a pair regardless of rejections.
/// Check is an async gate — throw to reject.
/// Before fires only when the query will execute.
/// </summary>
public interface IQueryPipelinePlugin
{
    string Name { get; }
    void Init(PipelineExecutionArgs args) { }
    Task CheckAsync(PipelineExecutionArgs args) => Task.CompletedTask;
    void Before(PipelineExecutionArgs args) { }
    void End(PipelineEndArgs args) { }
    void OnError(Exception error, PipelineExecutionArgs args) { }
}
