using System.Text.Json;
using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Vexnor.Mssql;
using Vexnor.Postgres;
using Vexnor.Sqlite3;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(options => options.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();
app.UseCors();

// ─── Manifest directories ────────────────────────────────────────────────────
var baseManifestDir = Environment.GetEnvironmentVariable("VEXNOR_MANIFEST_DIR")
    ?? Path.GetFullPath(Path.Join("..", "..", "..", "fixtures", "manifests"), Directory.GetCurrentDirectory());

// Load registries per dialect
var registries = new Dictionary<string, QueryRegistry>();
var dialects = new[] { ("postgres", "postgresql"), ("mssql", "transactsql"), ("sqlite3", "sqlite") };

foreach (var (name, dialect) in dialects)
{
    if (Path.IsPathRooted(name))
        throw new InvalidOperationException($"Dialect manifest subdirectory must be relative, but got rooted path: {name}");

    var dir = Path.Combine(baseManifestDir, name);
    var registry = new QueryRegistry(dialect);
    if (Directory.Exists(dir))
    {
        registry.LoadDirectory(dir);
        Console.WriteLine($"  [{name}] Loaded {registry.GetRegisteredHashes().Count} queries from {dir}");
    }
    else
    {
        Console.WriteLine($"  [{name}] WARNING: Manifest directory not found: {dir}");
    }
    registries[name] = registry;
}

// ─── Executors ───────────────────────────────────────────────────────────────
var executors = new Dictionary<string, DbExecutorBase>();

// Postgres
var pgConn = builder.Configuration.GetConnectionString("Postgres")
    ?? "Host=localhost;Port=5432;Database=postgres;Username=adrian";
executors["postgres"] = new PostgresExecutor(pgConn);

// MSSQL
var mssqlConn = builder.Configuration.GetConnectionString("Mssql")
    ?? "Server=localhost,1433;Database=vexnor;User Id=vexnor_dev;Password=P@ssw0rd!;TrustServerCertificate=true";
executors["mssql"] = new MssqlExecutor(mssqlConn);

// SQLite
var sqlitePath = builder.Configuration.GetConnectionString("Sqlite3")
    ?? Path.GetFullPath(Path.Join("..", "..", "..", "fixtures", "vexnor.db"), Directory.GetCurrentDirectory());
executors["sqlite3"] = Sqlite3Executor.FromPath(sqlitePath);

// ─── Endpoints ───────────────────────────────────────────────────────────────

app.MapGet("/api/health", () =>
{
    var status = registries.ToDictionary(kv => kv.Key, kv => kv.Value.GetRegisteredHashes().Count);
    return Results.Json(new { status = "ok", queries = status });
});

// Query execution — backend is determined by "backend" field or defaults to postgres
app.MapPost("/api/db", async (HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var body = await reader.ReadToEndAsync();
    var json = JsonDocument.Parse(body).RootElement;

    var hash = json.GetProperty("hash").GetString() ?? "";
    var backend = json.TryGetProperty("backend", out var backendEl) ? backendEl.GetString() ?? "postgres" : "postgres";
    var paramsElement = json.GetProperty("params");

    if (!registries.TryGetValue(backend, out var registry))
        return Results.Json(new { error = $"Unknown backend: {backend}" }, statusCode: 400);

    if (!executors.TryGetValue(backend, out var executor))
        return Results.Json(new { error = $"No executor configured for: {backend}" }, statusCode: 400);

    var parameters = new Dictionary<string, object?>();
    foreach (var prop in paramsElement.EnumerateObject())
    {
        parameters[prop.Name] = ConvertJsonElement(prop.Value);
    }

    // Build context from request (e.g. authenticated user from JWT)
    var context = new Dictionary<string, object?>();
    if (json.TryGetProperty("context", out var ctxEl))
    {
        foreach (var prop in ctxEl.EnumerateObject())
            context[prop.Name] = ConvertJsonElement(prop.Value);
    }

    try
    {
        var results = await registry.ExecuteAsync(hash, parameters, context,
            sql => executor.QueryAsync(sql));
        return Results.Json(new { rows = results });
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("Unknown query hash"))
    {
        return Results.Json(new { error = ex.Message }, statusCode: 404);
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("requires context") || ex.Message.Contains("requires authorization"))
    {
        return Results.Json(new { error = ex.Message }, statusCode: 403);
    }
    catch (Exception ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: 500);
    }
});

Console.WriteLine($"Starting server on http://localhost:5000");
app.Run("http://localhost:5000");

static object? ConvertJsonElement(JsonElement element)
{
    return element.ValueKind switch
    {
        JsonValueKind.String => element.GetString(),
        JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDouble(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null => null,
        JsonValueKind.Array => element.EnumerateArray().Select(ConvertJsonElement).ToArray(),
        JsonValueKind.Object => element.EnumerateObject().ToDictionary(p => p.Name, p => ConvertJsonElement(p.Value)),
        _ => element.GetRawText()
    };
}
