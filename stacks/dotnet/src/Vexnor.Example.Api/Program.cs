using System.Diagnostics;
using System.Text.Json;
using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Vexnor.Mssql;
using Vexnor.Postgres;
using Vexnor.Sqlite3;

// ─── Structured file logging ─────────────────────────────────────────────────
var fileLogger = new FileLogger(Path.Combine(Directory.GetCurrentDirectory(), "logs", "server.log"));

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(options => options.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();
app.UseCors();

// ─── Request logging middleware ──────────────────────────────────────────────
app.Use(async (context, next) =>
{
    var sw = Stopwatch.StartNew();
    await next(context);
    sw.Stop();
    fileLogger.Info("Request", new
    {
        method = context.Request.Method,
        path = context.Request.Path.Value,
        status = context.Response.StatusCode,
        duration_ms = sw.ElapsedMilliseconds
    });
});

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
        fileLogger.Info("Loaded manifests", new { dialect = name, queryCount = registry.GetRegisteredHashes().Count, dir });
    }
    else
    {
        fileLogger.Warn("Manifest directory not found", new { dialect = name, dir });
    }
    registries[name] = registry;
}

// ─── Executors ───────────────────────────────────────────────────────────────
var executors = new Dictionary<string, DbExecutorBase>();

// Postgres
var pgConn = builder.Configuration.GetConnectionString("Postgres")
    ?? "Host=localhost;Port=5432;Database=postgres;Username=adrian";
executors["postgres"] = new PostgresExecutor(pgConn);
fileLogger.Info("Database connected", new { dialect = "postgres" });

// MSSQL
var mssqlConn = builder.Configuration.GetConnectionString("Mssql")
    ?? "Server=localhost,1433;Database=vexnor;User Id=vexnor_dev;Password=P@ssw0rd!;TrustServerCertificate=true";
executors["mssql"] = new MssqlExecutor(mssqlConn);
fileLogger.Info("Database connected", new { dialect = "mssql" });

// SQLite
var sqlitePath = builder.Configuration.GetConnectionString("Sqlite3")
    ?? Path.GetFullPath(Path.Join("..", "..", "..", "fixtures", "vexnor.db"), Directory.GetCurrentDirectory());
executors["sqlite3"] = Sqlite3Executor.FromPath(sqlitePath);
fileLogger.Info("Database connected", new { dialect = "sqlite3", path = sqlitePath });

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
        fileLogger.Error("Query execution failed", new { hash, backend, error = ex.Message });
        return Results.Json(new { error = ex.Message }, statusCode: 404);
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("requires context") || ex.Message.Contains("requires authorization"))
    {
        fileLogger.Error("Query execution failed", new { hash, backend, error = ex.Message });
        return Results.Json(new { error = ex.Message }, statusCode: 403);
    }
    catch (Exception ex)
    {
        fileLogger.Error("Query execution failed", new { hash, backend, error = ex.Message });
        return Results.Json(new { error = ex.Message }, statusCode: 500);
    }
});

fileLogger.Info("Server starting", new { port = 5000, addr = "http://localhost:5000" });
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

/// <summary>
/// Simple structured JSON file logger that writes JSON lines to a file and also to stdout.
/// </summary>
sealed class FileLogger : IDisposable
{
    private readonly StreamWriter _writer;
    private readonly object _lock = new();
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public FileLogger(string filePath)
    {
        var dir = Path.GetDirectoryName(filePath)!;
        Directory.CreateDirectory(dir);
        // Truncate on creation
        _writer = new StreamWriter(filePath, append: false) { AutoFlush = true };
    }

    public void Info(string msg, object? data = null) => Write("info", msg, data);
    public void Warn(string msg, object? data = null) => Write("warn", msg, data);
    public void Error(string msg, object? data = null) => Write("error", msg, data);

    private void Write(string level, string msg, object? data)
    {
        var entry = new Dictionary<string, object?>
        {
            ["time"] = DateTime.UtcNow.ToString("O"),
            ["level"] = level,
            ["msg"] = msg
        };

        if (data != null)
        {
            // Serialize data to a JsonElement and merge its properties into the entry
            var dataJson = JsonSerializer.SerializeToElement(data, JsonOptions);
            if (dataJson.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in dataJson.EnumerateObject())
                {
                    entry[prop.Name] = prop.Value;
                }
            }
            else
            {
                entry["data"] = dataJson;
            }
        }

        var line = JsonSerializer.Serialize(entry, JsonOptions);
        lock (_lock)
        {
            _writer.WriteLine(line);
        }
        Console.WriteLine(line);
    }

    public void Dispose()
    {
        _writer.Dispose();
    }
}
