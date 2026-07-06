using System.Text.Json;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

/// <summary>
/// Tests covering ParamDefinition and ParamValidationSchema properties
/// that are deserialized from manifests but may not be exercised by other tests.
/// </summary>
public class ParamDefinitionTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    // ─── ParamDefinition Properties ──────────────────────────────────────────

    [Fact]
    public void Deserializes_AllProperties()
    {
        var json = """
        {
            "name": "userId",
            "isContext": true,
            "optional": true,
            "label": "User ID",
            "description": "The authenticated user's identifier",
            "validation": {
                "type": "filter",
                "columns": ["email", "name"],
                "operators": ["=", "like", "in"]
            }
        }
        """;

        var param = JsonSerializer.Deserialize<ParamDefinition>(json, JsonOptions)!;

        Assert.Equal("userId", param.Name);
        Assert.True(param.IsContext);
        Assert.True(param.Optional);
        Assert.Equal("User ID", param.Label);
        Assert.Equal("The authenticated user's identifier", param.Description);
        Assert.NotNull(param.Validation);
        Assert.Equal("filter", param.Validation!.Type);
        Assert.Equal(new[] { "email", "name" }, param.Validation.Columns);
        Assert.Equal(new[] { "=", "like", "in" }, param.Validation.Operators);
    }

    [Fact]
    public void Deserializes_MinimalParam()
    {
        var json = """{"name": "id"}""";

        var param = JsonSerializer.Deserialize<ParamDefinition>(json, JsonOptions)!;

        Assert.Equal("id", param.Name);
        Assert.False(param.IsContext);
        Assert.Null(param.Optional);
        Assert.Null(param.Label);
        Assert.Null(param.Description);
        Assert.Null(param.Validation);
    }

    [Fact]
    public void Optional_False_Deserialized()
    {
        var json = """{"name": "email", "optional": false}""";

        var param = JsonSerializer.Deserialize<ParamDefinition>(json, JsonOptions)!;

        Assert.False(param.Optional);
    }

    // ─── ParamValidationSchema ───────────────────────────────────────────────

    [Fact]
    public void ValidationSchema_Filter_WithOperators()
    {
        var json = """
        {
            "type": "filter",
            "columns": ["status", "email", "createdAt"],
            "operators": ["=", "!=", "like", "in", ">=", "<=", "between", "isNull", "isNotNull"]
        }
        """;

        var schema = JsonSerializer.Deserialize<ParamValidationSchema>(json, JsonOptions)!;

        Assert.Equal("filter", schema.Type);
        Assert.Equal(3, schema.Columns.Count);
        Assert.Equal(9, schema.Operators!.Count);
        Assert.Null(schema.Functions);
    }

    [Fact]
    public void ValidationSchema_Projection_WithFunctions()
    {
        var json = """
        {
            "type": "projection",
            "columns": ["orderId", "amount", "quantity"],
            "functions": ["count", "sum", "avg", "min", "max"]
        }
        """;

        var schema = JsonSerializer.Deserialize<ParamValidationSchema>(json, JsonOptions)!;

        Assert.Equal("projection", schema.Type);
        Assert.Equal(3, schema.Columns.Count);
        Assert.Null(schema.Operators);
        Assert.Equal(5, schema.Functions!.Count);
        Assert.Contains("avg", schema.Functions);
    }

    [Fact]
    public void ValidationSchema_Minimal_NoOperatorsOrFunctions()
    {
        var json = """{"type": "filter", "columns": ["id"]}""";

        var schema = JsonSerializer.Deserialize<ParamValidationSchema>(json, JsonOptions)!;

        Assert.Equal("filter", schema.Type);
        Assert.Single(schema.Columns);
        Assert.Null(schema.Operators);
        Assert.Null(schema.Functions);
    }

    // ─── Full QueryDefinition with params ────────────────────────────────────

    [Fact]
    public void QueryDefinition_Deserializes_WithAllParamFields()
    {
        var json = """
        {
            "name": "selectAccounts",
            "hash": "abc123",
            "location": "src/queries.ts:10:5",
            "template": [{"type": "text", "value": "SELECT 1"}],
            "params": {
                "userId": {
                    "name": "userId",
                    "isContext": true,
                    "label": "User ID",
                    "description": "Authenticated user",
                    "optional": false
                },
                "filter": {
                    "name": "filter",
                    "optional": true,
                    "validation": {
                        "type": "filter",
                        "columns": ["email"],
                        "operators": ["="]
                    }
                }
            },
            "authorization": ["user"],
            "row": {
                "accountId": {"type": "uuid"},
                "email": {"type": "string"}
            }
        }
        """;

        var query = JsonSerializer.Deserialize<QueryDefinition>(json, JsonOptions)!;

        Assert.Equal("selectAccounts", query.Name);
        Assert.Equal("abc123", query.Hash);
        Assert.Equal("src/queries.ts:10:5", query.Location);
        Assert.Equal(2, query.Params.Count);
        Assert.True(query.Params["userId"].IsContext);
        Assert.Equal("User ID", query.Params["userId"].Label);
        Assert.Equal("Authenticated user", query.Params["userId"].Description);
        Assert.True(query.Params["filter"].Optional);
        Assert.NotNull(query.Params["filter"].Validation);
        Assert.Single(query.Authorization);
        Assert.Equal("user", query.Authorization[0]);
        Assert.NotNull(query.Row);
        Assert.Equal("uuid", query.Row!["accountId"].Type);
    }
}
