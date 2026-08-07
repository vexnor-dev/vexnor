using System.Text.Json;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Vexnor.MongoDB;

/// <summary>
/// Executes MongoDB queries from manifest descriptors using the official MongoDB .NET driver.
/// </summary>
public class MongoDbExecutor : IDisposable
{
    private readonly IMongoDatabase _db;

    public MongoDbExecutor(IMongoDatabase db)
    {
        _db = db;
    }

    /// <summary>
    /// Creates an executor by connecting to the given URI and database.
    /// </summary>
    public static MongoDbExecutor FromUri(string uri, string database)
    {
        var client = new MongoClient(uri);
        var db = client.GetDatabase(database);
        return new MongoDbExecutor(db);
    }

    /// <summary>
    /// Executes a MongoDB query descriptor and returns results as dictionaries.
    /// </summary>
    public async Task<List<Dictionary<string, object?>>> QueryRowsAsync(
        Dictionary<string, object?> descriptor,
        Dictionary<string, object?>? parameters = null,
        CancellationToken ct = default)
    {
        var resolvedDescriptor = SubstituteParams(descriptor, parameters ?? new());

        var collName = resolvedDescriptor["collection"]?.ToString()
            ?? throw new InvalidOperationException("Missing 'collection' in descriptor");
        var operation = resolvedDescriptor["operation"]?.ToString()
            ?? throw new InvalidOperationException("Missing 'operation' in descriptor");

        var collection = _db.GetCollection<BsonDocument>(collName);

        return operation switch
        {
            "find" => await ExecuteFind(collection, resolvedDescriptor, ct),
            "aggregate" => await ExecuteAggregate(collection, resolvedDescriptor, ct),
            "deleteOne" => await ExecuteDeleteOne(collection, resolvedDescriptor, ct),
            "deleteMany" => await ExecuteDeleteMany(collection, resolvedDescriptor, ct),
            "insertOne" => await ExecuteInsertOne(collection, resolvedDescriptor, ct),
            "insertMany" => await ExecuteInsertMany(collection, resolvedDescriptor, ct),
            "updateOne" => await ExecuteUpdateOne(collection, resolvedDescriptor, ct),
            "updateMany" => await ExecuteUpdateMany(collection, resolvedDescriptor, ct),
            _ => throw new NotSupportedException($"Unsupported operation: {operation}")
        };
    }

    private async Task<List<Dictionary<string, object?>>> ExecuteFind(
        IMongoCollection<BsonDocument> collection,
        Dictionary<string, object?> desc,
        CancellationToken ct)
    {
        var filter = ToBsonDocument(desc.GetValueOrDefault("filter"));
        var options = new FindOptions<BsonDocument>();

        if (desc.TryGetValue("sort", out var sort) && sort != null)
            options.Sort = ToBsonDocument(sort);
        if (desc.TryGetValue("limit", out var limit) && limit != null && TryToInt(limit, out var limitVal))
            options.Limit = (int)limitVal;
        if (desc.TryGetValue("skip", out var skip) && skip != null && TryToInt(skip, out var skipVal))
            options.Skip = (int)skipVal;
        if (desc.TryGetValue("projection", out var proj) && proj != null)
            options.Projection = ToBsonDocument(proj);

        using var cursor = await collection.FindAsync(filter, options, ct);
        var results = new List<Dictionary<string, object?>>();
        while (await cursor.MoveNextAsync(ct))
        {
            foreach (var doc in cursor.Current)
            {
                results.Add(BsonDocToDict(doc));
            }
        }
        return results;
    }

    private async Task<List<Dictionary<string, object?>>> ExecuteAggregate(
        IMongoCollection<BsonDocument> collection,
        Dictionary<string, object?> desc,
        CancellationToken ct)
    {
        var pipelineRaw = desc.GetValueOrDefault("pipeline") as List<object?>
            ?? throw new InvalidOperationException("Aggregate requires 'pipeline' array");

        var stages = pipelineRaw
            .Select(stage => ToBsonDocument(stage))
            .Select(doc => (IPipelineStageDefinition)new BsonDocumentPipelineStageDefinition<BsonDocument, BsonDocument>(doc))
            .ToList();

        var pipeline = new PipelineStagePipelineDefinition<BsonDocument, BsonDocument>(stages);

        using var cursor = await collection.AggregateAsync(pipeline, cancellationToken: ct);
        var results = new List<Dictionary<string, object?>>();
        while (await cursor.MoveNextAsync(ct))
        {
            foreach (var doc in cursor.Current)
            {
                results.Add(BsonDocToDict(doc));
            }
        }
        return results;
    }

    private async Task<List<Dictionary<string, object?>>> ExecuteDeleteOne(
        IMongoCollection<BsonDocument> collection,
        Dictionary<string, object?> desc,
        CancellationToken ct)
    {
        var filter = ToBsonDocument(desc.GetValueOrDefault("filter"));
        var result = await collection.DeleteOneAsync(filter, ct);
        return [new() { ["deletedCount"] = result.DeletedCount }];
    }

    private async Task<List<Dictionary<string, object?>>> ExecuteDeleteMany(
        IMongoCollection<BsonDocument> collection,
        Dictionary<string, object?> desc,
        CancellationToken ct)
    {
        var filter = ToBsonDocument(desc.GetValueOrDefault("filter"));
        var result = await collection.DeleteManyAsync(filter, ct);
        return [new() { ["deletedCount"] = result.DeletedCount }];
    }

    private async Task<List<Dictionary<string, object?>>> ExecuteInsertOne(
        IMongoCollection<BsonDocument> collection,
        Dictionary<string, object?> desc,
        CancellationToken ct)
    {
        var doc = ToBsonDocument(desc.GetValueOrDefault("document"));
        await collection.InsertOneAsync(doc, cancellationToken: ct);
        return [BsonDocToDict(doc)];
    }

    private async Task<List<Dictionary<string, object?>>> ExecuteInsertMany(
        IMongoCollection<BsonDocument> collection,
        Dictionary<string, object?> desc,
        CancellationToken ct)
    {
        var docsRaw = desc.GetValueOrDefault("documents") as List<object?>
            ?? throw new InvalidOperationException("InsertMany requires 'documents' array");

        var docs = docsRaw.Select(d => ToBsonDocument(d)).ToList();
        await collection.InsertManyAsync(docs, cancellationToken: ct);
        return docs.Select(BsonDocToDict).ToList();
    }

    private async Task<List<Dictionary<string, object?>>> ExecuteUpdateOne(
        IMongoCollection<BsonDocument> collection,
        Dictionary<string, object?> desc,
        CancellationToken ct)
    {
        var filter = ToBsonDocument(desc.GetValueOrDefault("filter"));
        var update = ToBsonDocument(desc.GetValueOrDefault("update"));
        var result = await collection.UpdateOneAsync(filter, update, cancellationToken: ct);
        return [new()
        {
            ["matchedCount"] = result.MatchedCount,
            ["modifiedCount"] = result.ModifiedCount
        }];
    }

    private async Task<List<Dictionary<string, object?>>> ExecuteUpdateMany(
        IMongoCollection<BsonDocument> collection,
        Dictionary<string, object?> desc,
        CancellationToken ct)
    {
        var filter = ToBsonDocument(desc.GetValueOrDefault("filter"));
        var update = ToBsonDocument(desc.GetValueOrDefault("update"));
        var result = await collection.UpdateManyAsync(filter, update, cancellationToken: ct);
        return [new()
        {
            ["matchedCount"] = result.MatchedCount,
            ["modifiedCount"] = result.ModifiedCount
        }];
    }

    // ─── Param substitution ──────────────────────────────────────────────────────

    private static Dictionary<string, object?> SubstituteParams(
        Dictionary<string, object?> descriptor,
        Dictionary<string, object?> parameters)
    {
        return (Dictionary<string, object?>)SubstituteValue(descriptor, parameters)!;
    }

    private static object? SubstituteValue(object? value, Dictionary<string, object?> parameters)
    {
        if (value is null) return null;

        if (value is Dictionary<string, object?> dict)
        {
            // $param marker
            if (dict.TryGetValue("$param", out var paramName) && paramName is string pn)
                return parameters.GetValueOrDefault(pn);

            // $ctx marker
            if (dict.TryGetValue("$ctx", out var ctxName) && ctxName is string cn)
                return parameters.GetValueOrDefault(cn);

            // $literal marker
            if (dict.TryGetValue("$literal", out var literal) && dict.Count == 1)
                return literal;

            // Recurse
            var result = new Dictionary<string, object?>(dict.Count);
            foreach (var (key, val) in dict)
                result[key] = SubstituteValue(val, parameters);
            return result;
        }

        if (value is List<object?> list)
        {
            return list.Select(item => SubstituteValue(item, parameters)).ToList();
        }

        if (value is JsonElement je)
        {
            return SubstituteJsonElement(je, parameters);
        }

        return value;
    }

    private static object? SubstituteJsonElement(JsonElement element, Dictionary<string, object?> parameters)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                var dict = new Dictionary<string, object?>();
                foreach (var prop in element.EnumerateObject())
                    dict[prop.Name] = SubstituteJsonElement(prop.Value, parameters);
                return SubstituteValue(dict, parameters);

            case JsonValueKind.Array:
                var list = element.EnumerateArray()
                    .Select(item => SubstituteJsonElement(item, parameters))
                    .ToList();
                return list;

            case JsonValueKind.String:
                return element.GetString();
            case JsonValueKind.Number:
                return element.TryGetInt64(out var l) ? l : element.GetDouble();
            case JsonValueKind.True:
                return true;
            case JsonValueKind.False:
                return false;
            case JsonValueKind.Null:
                return null;
            default:
                return null;
        }
    }

    // ─── BSON helpers ────────────────────────────────────────────────────────────

    private static BsonDocument ToBsonDocument(object? value)
    {
        if (value is null) return new BsonDocument();

        if (value is Dictionary<string, object?> dict)
        {
            var doc = new BsonDocument();
            foreach (var (key, val) in dict)
                doc[key] = ToBsonValue(val);
            return doc;
        }

        if (value is JsonElement je && je.ValueKind == JsonValueKind.Object)
        {
            var doc = new BsonDocument();
            foreach (var prop in je.EnumerateObject())
                doc[prop.Name] = JsonElementToBsonValue(prop.Value);
            return doc;
        }

        return new BsonDocument();
    }

    private static BsonValue ToBsonValue(object? value)
    {
        if (value is null) return BsonNull.Value;

        return value switch
        {
            string s => new BsonString(s),
            int i => new BsonInt32(i),
            long l => new BsonInt64(l),
            double d => new BsonDouble(d),
            float f => new BsonDouble(f),
            bool b => new BsonBoolean(b),
            Dictionary<string, object?> dict => ToBsonDocument(dict).ToBsonDocument(),
            List<object?> list => new BsonArray(list.Select(ToBsonValue)),
            JsonElement je => JsonElementToBsonValue(je),
            _ => BsonValue.Create(value)
        };
    }

    private static BsonValue JsonElementToBsonValue(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Object => ToBsonDocument(element).ToBsonDocument(),
            JsonValueKind.Array => new BsonArray(element.EnumerateArray().Select(JsonElementToBsonValue)),
            JsonValueKind.String => new BsonString(element.GetString()),
            JsonValueKind.Number => element.TryGetInt64(out var l) ? new BsonInt64(l) : new BsonDouble(element.GetDouble()),
            JsonValueKind.True => new BsonBoolean(true),
            JsonValueKind.False => new BsonBoolean(false),
            JsonValueKind.Null => BsonNull.Value,
            _ => BsonNull.Value
        };
    }

    private static Dictionary<string, object?> BsonDocToDict(BsonDocument doc)
    {
        var result = new Dictionary<string, object?>(doc.ElementCount);
        foreach (var element in doc)
        {
            result[element.Name] = BsonValueToObject(element.Value);
        }
        return result;
    }

    private static object? BsonValueToObject(BsonValue value)
    {
        return value.BsonType switch
        {
            BsonType.Document => BsonDocToDict(value.AsBsonDocument),
            BsonType.Array => value.AsBsonArray.Select(BsonValueToObject).ToList(),
            BsonType.String => value.AsString,
            BsonType.Int32 => value.AsInt32,
            BsonType.Int64 => value.AsInt64,
            BsonType.Double => value.AsDouble,
            BsonType.Boolean => value.AsBoolean,
            BsonType.DateTime => value.ToUniversalTime(),
            BsonType.ObjectId => value.AsObjectId.ToString(),
            BsonType.Null => null,
            _ => value.ToString()
        };
    }

    private static bool TryToInt(object? value, out long result)
    {
        result = 0;
        switch (value)
        {
            case int i: result = i; return true;
            case long l: result = l; return true;
            case double d: result = (long)d; return true;
            case JsonElement je when je.TryGetInt64(out var jl): result = jl; return true;
            default: return false;
        }
    }

    public void Dispose()
    {
        // MongoClient handles its own connection pooling, no explicit dispose needed
        GC.SuppressFinalize(this);
    }
}
