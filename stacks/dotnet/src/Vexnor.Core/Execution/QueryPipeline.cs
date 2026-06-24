using System.Diagnostics;
using Vexnor.Core.Manifest;

namespace Vexnor.Core.Execution;

/// <summary>
/// Authorization hook delegate. Throw to deny execution.
/// </summary>
public delegate void AuthorizeHook(AuthorizeArgs args);

/// <summary>
/// Args passed to authorization hooks.
/// </summary>
public sealed class AuthorizeArgs
{
    public required QueryDefinition Query { get; init; }
    public required string Name { get; init; }
    public required List<string> Tags { get; init; }
    public required Dictionary<string, object?> Context { get; init; }
}

/// <summary>
/// Composable query pipeline that sequences authorization, plugins, and execution.
/// </summary>
public sealed class QueryPipeline
{
    private readonly List<IQueryPipelinePlugin> _plugins = new();
    private readonly List<AuthorizeHook> _authHooks = new();

    public void Use(IQueryPipelinePlugin plugin)
    {
        _plugins.Add(plugin);
    }

    public Action RegisterAuthorization(AuthorizeHook hook)
    {
        _authHooks.Add(hook);
        return () => _authHooks.Remove(hook);
    }

    /// <summary>
    /// Asserts every query with authorization tags has at least one hook registered.
    /// Throws if any tagged query would bypass authorization.
    /// </summary>
    public void CheckAuthorization(IEnumerable<QueryDefinition> queries)
    {
        if (_authHooks.Count > 0) return;

        var tagged = queries.Where(q => q.Authorization.Count > 0).ToList();
        if (tagged.Count > 0)
        {
            var names = string.Join(", ", tagged.Select(q => q.Name));
            throw new InvalidOperationException(
                $"No authorization hooks registered but these queries require authorization: {names}");
        }
    }

    /// <summary>
    /// Executes the full pipeline lifecycle around a query execution function.
    /// </summary>
    public async Task<TResult> ExecuteAsync<TResult>(
        PipelineExecutionArgs args,
        Func<Task<TResult>> executeFn)
    {
        var sw = Stopwatch.StartNew();
        Exception? error = null;

        // Init — always fires
        foreach (var plugin in _plugins)
        {
            try { plugin.Init(args); }
            catch (Exception ex) { SafeOnError(plugin, ex, args); }
        }

        try
        {
            // Authorization
            if (args.Query.Authorization.Count > 0)
            {
                var authArgs = new AuthorizeArgs
                {
                    Query = args.Query,
                    Name = args.Name,
                    Tags = args.Query.Authorization,
                    Context = args.Context,
                };

                foreach (var hook in _authHooks)
                {
                    hook(authArgs); // throw to deny
                }
            }

            // Check — async gate
            foreach (var plugin in _plugins)
            {
                await plugin.CheckAsync(args);
            }

            // Before — sync observer
            foreach (var plugin in _plugins)
            {
                try { plugin.Before(args); }
                catch (Exception ex) { SafeOnError(plugin, ex, args); }
            }

            // Execute
            return await executeFn();
        }
        catch (Exception ex)
        {
            error = ex;
            throw;
        }
        finally
        {
            sw.Stop();
            var endArgs = new PipelineEndArgs
            {
                Execution = args,
                DurationMs = sw.ElapsedMilliseconds,
                Error = error,
            };

            // End — always fires (paired with Init)
            foreach (var plugin in _plugins)
            {
                try { plugin.End(endArgs); }
                catch (Exception ex) { SafeOnError(plugin, ex, args); }
            }
        }
    }

    private static void SafeOnError(IQueryPipelinePlugin plugin, Exception error, PipelineExecutionArgs args)
    {
        try { plugin.OnError(error, args); }
        catch { /* swallow errors in error handler */ }
    }
}
