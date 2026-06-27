using System.Linq;
using Vexnor.Core.Manifest;

namespace Vexnor.Core.Execution;

/// <summary>
/// Registry of portable queries loaded from a manifest.
/// Resolves queries by hash and builds executable SQL with runtime parameters.
/// Supports authorization, context injection, and pipeline plugins.
/// </summary>
public sealed class QueryRegistry
{
    private readonly Dictionary<string, QueryDefinition> _queries = new();
    private readonly string _dialect;
    private readonly QueryPipeline _pipeline = new();

    public QueryRegistry(string dialect)
    {
        _dialect = dialect;
    }

    // ─── Pipeline ────────────────────────────────────────────────────────────

    /// <summary>Registers a pipeline plugin.</summary>
    public void Use(IQueryPipelinePlugin plugin) => _pipeline.Use(plugin);

    /// <summary>Registers an authorization hook. Throw inside the hook to deny.</summary>
    public Action RegisterAuthorization(AuthorizeHook hook) => _pipeline.RegisterAuthorization(hook);

    /// <summary>
    /// Asserts every .authorize()-tagged query has a hook. Call at startup.
    /// </summary>
    public void CheckAuthorization() => _pipeline.CheckAuthorization(_queries.Values);

    /// <summary>Returns queries that have authorization tags.</summary>
    public IEnumerable<QueryDefinition> GetAuthorizedQueries() =>
        _queries.Values.Where(q => q.Authorization.Count > 0);

    /// <summary>Returns queries that have NO authorization tags.</summary>
    public IEnumerable<QueryDefinition> GetUnauthorizedQueries() =>
        _queries.Values.Where(q => q.Authorization.Count == 0);

    // ─── Loading ─────────────────────────────────────────────────────────────

    public void Load(QueryManifest manifest)
    {
        foreach (var (hash, query) in manifest.Queries)
        {
            _queries[hash] = query;
        }
    }

    public void LoadFile(string path)
    {
        var manifest = ManifestLoader.LoadFile(path);
        Load(manifest);
    }

    public void LoadDirectory(string directory, string pattern = "*.json")
    {
        var manifest = ManifestLoader.LoadGlob(directory, pattern);
        Load(manifest);
    }

    // ─── Query Resolution ────────────────────────────────────────────────────

    /// <summary>
    /// Resolves a query by hash and builds the SQL with parameters.
    /// Does NOT run through the pipeline — use ExecuteAsync for full lifecycle.
    /// </summary>
    public SqlBuildResult Build(string hash, Dictionary<string, object?> parameters)
    {
        if (!_queries.TryGetValue(hash, out var query))
            throw new InvalidOperationException($"Unknown query hash: {hash}");

        return new SqlBuilder(_dialect).Build(query, parameters);
    }

    /// <summary>
    /// Full pipeline execution: resolve → inject context → authorize → plugins → build → execute.
    /// </summary>
    public async Task<TResult> ExecuteAsync<TResult>(
        string hash,
        Dictionary<string, object?> parameters,
        Dictionary<string, object?> context,
        Func<SqlBuildResult, Task<TResult>> executeFn)
    {
        if (!_queries.TryGetValue(hash, out var query))
            throw new InvalidOperationException($"Unknown query hash: {hash}");

        // Context injection — resolve ctx() params from server-provided context
        InjectContext(query, parameters, context);

        var args = new PipelineExecutionArgs
        {
            Hash = hash,
            Name = query.Name,
            Location = query.Location,
            Query = query,
            Params = parameters,
            Context = context,
        };

        return await _pipeline.ExecuteAsync(args, async () =>
        {
            ValidateStructuredParams(query, parameters);
            var sql = new SqlBuilder(_dialect).Build(query, parameters);
            return await executeFn(sql);
        });
    }

    // ─── Context Injection ───────────────────────────────────────────────────

    /// <summary>
    /// Injects context values into parameters for any param marked isContext=true.
    /// Throws if a required context value is missing.
    /// </summary>
    private static void InjectContext(
        QueryDefinition query,
        Dictionary<string, object?> parameters,
        Dictionary<string, object?> context)
    {
        foreach (var (name, def) in query.Params)
        {
            if (!def.IsContext) continue;

            if (context.TryGetValue(name, out var value))
            {
                parameters[name] = value;
            }
            else
            {
                throw new InvalidOperationException(
                    $"Query '{query.Name}' requires context value '{name}' but it was not provided");
            }
        }
    }

    // ─── Introspection ───────────────────────────────────────────────────────

    public IReadOnlyCollection<string> GetRegisteredHashes() => _queries.Keys;

    public QueryDefinition? GetQuery(string hash) =>
        _queries.TryGetValue(hash, out var query) ? query : null;

    public IEnumerable<(string Hash, string Name)> GetRegisteredQueries() =>
        _queries.Select(kv => (kv.Key, kv.Value.Name));

    // ─── Param Validation ────────────────────────────────────────────────────

    private static void ValidateStructuredParams(QueryDefinition query, Dictionary<string, object?> parameters)
    {
        foreach (var (name, def) in query.Params)
        {
            if (def.Validation == null) continue;
            if (!parameters.TryGetValue(name, out var value) || value == null) continue;

            var errors = def.Validation.Type switch
            {
                "filter" => ValidateFilterParam(def.Validation, value),
                "projection" => ValidateProjectionParam(def.Validation, value),
                _ => null,
            };

            if (errors is { Count: > 0 })
                throw new InvalidOperationException(
                    $"Invalid param '{name}' on query '{query.Name}': {string.Join("; ", errors)}");
        }
    }

    private static List<string>? ValidateFilterParam(ParamValidationSchema schema, object value)
    {
        var errors = new List<string>();
        var columns = new HashSet<string>(schema.Columns);
        var operators = new HashSet<string>(schema.Operators ?? []);

        void ValidateConditions(IEnumerable<object?> conditions)
        {
            foreach (var dict in conditions.OfType<Dictionary<string, object?>>())
            {
                if (dict.TryGetValue("or", out var orVal) && orVal is object?[] orArray)
                {
                    ValidateConditions(orArray);
                    continue;
                }
                foreach (var (key, val) in dict)
                {
                    if (!columns.Contains(key))
                        errors.Add($"Column not found: {key}");
                    if (val is object?[] tuple && tuple.Length >= 1 && tuple[0] is string op && !operators.Contains(op))
                        errors.Add($"Invalid filter operator: {op}");
                }
            }
        }

        if (value is Dictionary<string, object?> legacyDict)
        {
            foreach (var key in legacyDict.Keys.Where(key => !columns.Contains(key)))
                errors.Add($"Column not found: {key}");
        }
        else if (value is object?[] array)
        {
            ValidateConditions(array);
        }

        return errors.Count > 0 ? errors : null;
    }

    private static List<string>? ValidateProjectionParam(ParamValidationSchema schema, object value)
    {
        if (value is not object?[] entries) return null;
        var errors = new List<string>();
        var columns = new HashSet<string>(schema.Columns);
        var functions = new HashSet<string>(schema.Functions ?? []);

        foreach (var entry in entries)
        {
            if (entry is string colName && !columns.Contains(colName))
                errors.Add($"Column not found: {colName}");
            else if (entry is object?[] tuple && tuple.Length >= 1 && tuple[0] is string fn && !functions.Contains(fn))
                errors.Add($"Invalid aggregate function: {fn}");
        }

        return errors.Count > 0 ? errors : null;
    }
}
