using System.Text.Json.Serialization;

namespace Vexnor.Core.Manifest;

public sealed class QueryManifest
{
    [JsonPropertyName("version")]
    public int Version { get; init; }

    [JsonPropertyName("generatorVersion")]
    public string GeneratorVersion { get; init; } = "";

    [JsonPropertyName("dialect")]
    public string Dialect { get; init; } = "";

    [JsonPropertyName("queries")]
    public Dictionary<string, QueryDefinition> Queries { get; init; } = new();
}

public sealed class QueryDefinition
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = "";

    [JsonPropertyName("location")]
    public string? Location { get; init; }

    [JsonPropertyName("hash")]
    public string Hash { get; init; } = "";

    [JsonPropertyName("template")]
    public List<TemplateNode> Template { get; init; } = new();

    [JsonPropertyName("params")]
    public Dictionary<string, ParamDefinition> Params { get; init; } = new();

    [JsonPropertyName("row")]
    public Dictionary<string, ColumnSchema>? Row { get; init; }

    [JsonPropertyName("authorization")]
    public List<string> Authorization { get; init; } = new();
}

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(TextNode), "text")]
[JsonDerivedType(typeof(ParamNode), "param")]
[JsonDerivedType(typeof(ValueNode), "value")]
[JsonDerivedType(typeof(WhenNode), "when")]
[JsonDerivedType(typeof(SetNode), "set")]
[JsonDerivedType(typeof(InsertNode), "insert")]
[JsonDerivedType(typeof(InsertColsNode), "insertCols")]
[JsonDerivedType(typeof(InsertValuesNode), "insertValues")]
[JsonDerivedType(typeof(FilterNode), "filter")]
[JsonDerivedType(typeof(OrderByNode), "orderBy")]
[JsonDerivedType(typeof(ProjectionNode), "projection")]
[JsonDerivedType(typeof(PaginationNode), "pagination")]
public abstract class TemplateNode { }

public sealed class TextNode : TemplateNode
{
    [JsonPropertyName("value")]
    public string Value { get; init; } = "";
}

public sealed class ParamNode : TemplateNode
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = "";

    [JsonPropertyName("array")]
    public bool? Array { get; init; }
}

public sealed class ValueNode : TemplateNode
{
    [JsonPropertyName("value")]
    public object? Value { get; init; }
}

public sealed class WhenNode : TemplateNode
{
    [JsonPropertyName("param")]
    public string Param { get; init; } = "";

    [JsonPropertyName("negate")]
    public bool Negate { get; init; }

    [JsonPropertyName("onTrue")]
    public List<TemplateNode> OnTrue { get; init; } = new();

    [JsonPropertyName("onFalse")]
    public List<TemplateNode>? OnFalse { get; init; }
}

public sealed class SetNode : TemplateNode
{
    [JsonPropertyName("param")]
    public string Param { get; init; } = "";

    [JsonPropertyName("columns")]
    public Dictionary<string, string> Columns { get; init; } = new();
}

public sealed class InsertNode : TemplateNode
{
    [JsonPropertyName("param")]
    public string Param { get; init; } = "";

    [JsonPropertyName("columns")]
    public Dictionary<string, string> Columns { get; init; } = new();
}

public sealed class InsertColsNode : TemplateNode
{
    [JsonPropertyName("param")]
    public string Param { get; init; } = "";

    [JsonPropertyName("columns")]
    public Dictionary<string, string> Columns { get; init; } = new();
}

public sealed class InsertValuesNode : TemplateNode
{
    [JsonPropertyName("param")]
    public string Param { get; init; } = "";

    [JsonPropertyName("keys")]
    public List<string> Keys { get; init; } = new();
}

public sealed class FilterNode : TemplateNode
{
    [JsonPropertyName("param")]
    public string Param { get; init; } = "";

    [JsonPropertyName("columns")]
    public Dictionary<string, string> Columns { get; init; } = new();

    [JsonPropertyName("prefix")]
    public string? Prefix { get; init; }

    [JsonPropertyName("suffix")]
    public string? Suffix { get; init; }
}

public sealed class OrderByNode : TemplateNode
{
    [JsonPropertyName("param")]
    public string Param { get; init; } = "";

    [JsonPropertyName("columns")]
    public Dictionary<string, string> Columns { get; init; } = new();
}

public sealed class ParamDefinition
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = "";

    [JsonPropertyName("isContext")]
    public bool IsContext { get; init; }

    [JsonPropertyName("optional")]
    public bool? Optional { get; init; }

    [JsonPropertyName("label")]
    public string? Label { get; init; }

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("validation")]
    public ParamValidationSchema? Validation { get; init; }
}

public sealed class ParamValidationSchema
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = "";

    [JsonPropertyName("columns")]
    public List<string> Columns { get; init; } = new();

    [JsonPropertyName("operators")]
    public List<string>? Operators { get; init; }

    [JsonPropertyName("functions")]
    public List<string>? Functions { get; init; }
}

public sealed class ColumnSchema
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = "";
}

public sealed class ProjectionNode : TemplateNode
{
    [JsonPropertyName("param")]
    public string Param { get; init; } = "";

    [JsonPropertyName("columns")]
    public Dictionary<string, string> Columns { get; init; } = new();
}

public sealed class PaginationNode : TemplateNode { }
