using System.Text.Json.Serialization;

namespace Vexnor.MongoDB;

/// <summary>
/// Represents a MongoDB query manifest for cross-runtime execution.
/// </summary>
public class MongoManifest
{
    [JsonPropertyName("version")]
    public int Version { get; set; }

    [JsonPropertyName("dialect")]
    public string Dialect { get; set; } = "mongodb";

    [JsonPropertyName("queries")]
    public Dictionary<string, MongoQueryEntry> Queries { get; set; } = new();
}

/// <summary>
/// Represents a single query entry in the MongoDB manifest.
/// </summary>
public class MongoQueryEntry
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("hash")]
    public string Hash { get; set; } = "";

    [JsonPropertyName("descriptor")]
    public Dictionary<string, object?> Descriptor { get; set; } = new();

    [JsonPropertyName("params")]
    public Dictionary<string, MongoParamDef> Params { get; set; } = new();

    [JsonPropertyName("schema")]
    public Dictionary<string, object?> Schema { get; set; } = new();
}

/// <summary>
/// Describes a parameter declared on a MongoDB query.
/// </summary>
public class MongoParamDef
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("isContext")]
    public bool IsContext { get; set; }
}
