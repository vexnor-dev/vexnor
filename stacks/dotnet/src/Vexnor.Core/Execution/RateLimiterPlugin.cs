using System.Collections.Concurrent;

namespace Vexnor.Core.Execution;

/// <summary>
/// Configuration for the rate limiter plugin.
/// </summary>
public sealed class RateLimiterOptions
{
    /// <summary>Plugin name. Defaults to "RateLimiterPlugin".</summary>
    public string Name { get; init; } = "RateLimiterPlugin";

    /// <summary>Derives a stable key from context (e.g. user ID). When null, per-context limits are disabled.</summary>
    public Func<Dictionary<string, object?>, string>? ContextKeyResolver { get; init; }

    /// <summary>Max concurrent executions of any single query (by hash). 0 = unlimited.</summary>
    public int MaxConcurrent { get; init; }

    /// <summary>Max concurrent executions per context key. Only applies when ContextKeyResolver is set. 0 = unlimited.</summary>
    public int MaxConcurrentPerContext { get; init; }

    /// <summary>TTL for idle context entries in milliseconds. Defaults to 5 minutes.</summary>
    public long ContextTtlMs { get; init; } = 300_000;
}

/// <summary>
/// Per-query and per-context concurrency rate limiter.
/// Rejects with InvalidOperationException when limits are exceeded.
/// </summary>
public sealed class RateLimiterPlugin : IQueryPipelinePlugin
{
    private readonly RateLimiterOptions _options;
    private readonly ConcurrentDictionary<string, int> _queryInFlight = new();
    private readonly ConcurrentDictionary<string, int> _contextInFlight = new();

    public string Name => _options.Name;

    public RateLimiterPlugin(RateLimiterOptions options)
    {
        _options = options;
    }

    public void Init(PipelineExecutionArgs args)
    {
        // Increment query in-flight
        _queryInFlight.AddOrUpdate(args.Hash, 1, (_, v) => v + 1);

        // Increment context in-flight
        if (_options.ContextKeyResolver != null)
        {
            var key = ResolveKey(args);
            _contextInFlight.AddOrUpdate(key, 1, (_, v) => v + 1);
        }
    }

    public Task CheckAsync(PipelineExecutionArgs args)
    {
        // Check per-query limit
        if (_options.MaxConcurrent > 0)
        {
            var current = _queryInFlight.GetValueOrDefault(args.Hash, 0);
            if (current > _options.MaxConcurrent)
            {
                throw new InvalidOperationException(
                    $"Rate limited: query '{args.Name}' has {current} concurrent executions (max: {_options.MaxConcurrent})");
            }
        }

        // Check per-context limit
        if (_options.MaxConcurrentPerContext > 0 && _options.ContextKeyResolver != null)
        {
            var key = ResolveKey(args);
            var current = _contextInFlight.GetValueOrDefault(key, 0);
            if (current > _options.MaxConcurrentPerContext)
            {
                throw new InvalidOperationException(
                    $"Rate limited: context '{key}' has {current} concurrent executions (max: {_options.MaxConcurrentPerContext})");
            }
        }

        return Task.CompletedTask;
    }

    public void End(PipelineEndArgs args)
    {
        // Decrement query in-flight
        _queryInFlight.AddOrUpdate(args.Execution.Hash, 0, (_, v) => Math.Max(0, v - 1));

        // Decrement context in-flight
        if (_options.ContextKeyResolver != null)
        {
            var key = ResolveKey(args.Execution);
            _contextInFlight.AddOrUpdate(key, 0, (_, v) => Math.Max(0, v - 1));
        }
    }

    private string ResolveKey(PipelineExecutionArgs args) =>
        $"{args.Hash}:{_options.ContextKeyResolver!(args.Context)}";
}
