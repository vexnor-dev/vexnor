namespace Vexnor.Core.Execution;

/// <summary>
/// Audit log entry emitted after every pipeline execution.
/// </summary>
public sealed class AuditLogEntry
{
    public required string Name { get; init; }
    public required string Hash { get; init; }
    public required string? Location { get; init; }
    public required long DurationMs { get; init; }
    public required string? Error { get; init; }
    public required Dictionary<string, object?>? Context { get; init; }
}

/// <summary>
/// Configuration for the audit log plugin.
/// </summary>
public sealed class AuditLogOptions
{
    /// <summary>Plugin name. Defaults to "AuditLogPlugin".</summary>
    public string Name { get; init; } = "AuditLogPlugin";

    /// <summary>
    /// Opt-in projection of context into the audit log.
    /// Raw context is never forwarded — only what this resolver returns.
    /// When null, Context in the log entry is null.
    /// </summary>
    public Func<Dictionary<string, object?>, Dictionary<string, object?>>? ContextLogResolver { get; init; }

    /// <summary>Called after every pipeline execution (success, failure, or rejection).</summary>
    public required Action<AuditLogEntry> OnLog { get; init; }
}

/// <summary>
/// Built-in audit log plugin. Fires in End() — after every execution including denials.
/// </summary>
public sealed class AuditLogPlugin : IQueryPipelinePlugin
{
    private readonly AuditLogOptions _options;

    public string Name => _options.Name;

    public AuditLogPlugin(AuditLogOptions options)
    {
        _options = options;
    }

    public void End(PipelineEndArgs args)
    {
        var context = _options.ContextLogResolver?.Invoke(args.Execution.Context);

        _options.OnLog(new AuditLogEntry
        {
            Name = args.Execution.Name,
            Hash = args.Execution.Hash,
            Location = args.Execution.Location,
            DurationMs = args.DurationMs,
            Error = args.Error?.Message,
            Context = context,
        });
    }
}
