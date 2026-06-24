using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

public class SqlBuilderFilterOperatorTests
{
    private readonly SqlBuilder _builder = new("postgresql");

    private QueryDefinition MakeFilterQuery() => new()
    {
        Name = "test", Hash = "abc",
        Template =
        {
            new TextNode { Value = "SELECT * WHERE " },
            new FilterNode
            {
                Param = "filter",
                Columns = new()
                {
                    ["email"] = "\"email\"",
                    ["status"] = "\"status\"",
                    ["age"] = "\"age\"",
                    ["createdAt"] = "\"created_at\"",
                    ["parentId"] = "\"parent_id\"",
                }
            }
        }
    };

    [Fact]
    public void Filter_Equal_Operator()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["email"] = new object?[] { "=", "test@x.com" } } }
        });
        Assert.Contains("\"email\" = $1", result.Text);
        Assert.Equal("test@x.com", result.Values[0]);
    }

    [Fact]
    public void Filter_Not_Operator()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["status"] = new object?[] { "not", "deleted" } } }
        });
        Assert.Contains("\"status\" <> $1", result.Text);
    }

    [Fact]
    public void Filter_GreaterThan_Operator()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["age"] = new object?[] { ">", 18 } } }
        });
        Assert.Contains("\"age\" > $1", result.Text);
        Assert.Equal(18, result.Values[0]);
    }

    [Fact]
    public void Filter_GreaterOrEqual_Operator()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["age"] = new object?[] { ">=", 21 } } }
        });
        Assert.Contains("\"age\" >= $1", result.Text);
    }

    [Fact]
    public void Filter_LowerThan_Operator()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["age"] = new object?[] { "<", 65 } } }
        });
        Assert.Contains("\"age\" < $1", result.Text);
    }

    [Fact]
    public void Filter_LowerOrEqual_Operator()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["age"] = new object?[] { "<=", 30 } } }
        });
        Assert.Contains("\"age\" <= $1", result.Text);
    }

    [Fact]
    public void Filter_Between_Operator()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["age"] = new object?[] { "between", 18, 65 } } }
        });
        Assert.Contains("\"age\" between $1 and $2", result.Text);
        Assert.Equal(18, result.Values[0]);
        Assert.Equal(65, result.Values[1]);
    }

    [Fact]
    public void Filter_In_Operator()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["status"] = new object?[] { "in", "active", "confirmed" } } }
        });
        Assert.Contains("\"status\" in ($1, $2)", result.Text);
        Assert.Equal("active", result.Values[0]);
        Assert.Equal("confirmed", result.Values[1]);
    }

    [Fact]
    public void Filter_In_EmptyArray_Produces_FalseCondition()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["status"] = new object?[] { "in" } } }
        });
        Assert.Contains("1 = 0", result.Text);
    }

    [Fact]
    public void Filter_NotIn_Operator()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["status"] = new object?[] { "notIn", "deleted", "banned" } } }
        });
        Assert.Contains("\"status\" not in ($1, $2)", result.Text);
    }

    [Fact]
    public void Filter_NotIn_EmptyArray_Produces_TrueCondition()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["status"] = new object?[] { "notIn" } } }
        });
        Assert.Contains("1 = 1", result.Text);
    }

    [Fact]
    public void Filter_Like_Operator()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["email"] = new object?[] { "like", "%@vip.com" } } }
        });
        Assert.Contains("\"email\" like $1", result.Text);
        Assert.Equal("%@vip.com", result.Values[0]);
    }

    [Fact]
    public void Filter_NotLike_Operator()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["email"] = new object?[] { "notLike", "%spam%" } } }
        });
        Assert.Contains("\"email\" not like $1", result.Text);
    }

    [Fact]
    public void Filter_IsNull_Operator()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["parentId"] = new object?[] { "isNull" } } }
        });
        Assert.Contains("\"parent_id\" is null", result.Text);
        Assert.Empty(result.Values);
    }

    [Fact]
    public void Filter_IsNotNull_Operator()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["parentId"] = new object?[] { "isNotNull" } } }
        });
        Assert.Contains("\"parent_id\" is not null", result.Text);
        Assert.Empty(result.Values);
    }

    [Fact]
    public void Filter_OrGroup()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[]
            {
                new Dictionary<string, object?> { ["status"] = "active" },
                new Dictionary<string, object?>
                {
                    ["or"] = new object?[]
                    {
                        new Dictionary<string, object?> { ["email"] = new object?[] { "like", "%@vip.com" } },
                        new Dictionary<string, object?> { ["parentId"] = new object?[] { "isNotNull" } },
                    }
                }
            }
        });
        Assert.Contains("\"status\" = $1", result.Text);
        Assert.Contains("(\"email\" like $2 or \"parent_id\" is not null)", result.Text);
    }

    [Fact]
    public void Filter_MultipleConditions_JoinedWithAnd()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[]
            {
                new Dictionary<string, object?> { ["status"] = "active" },
                new Dictionary<string, object?> { ["age"] = new object?[] { ">=", 18 } },
            }
        });
        Assert.Contains("\"status\" = $1 and \"age\" >= $2", result.Text);
    }

    [Fact]
    public void Filter_LegacyObjectForm_StillWorks()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new Dictionary<string, object?> { ["email"] = "jane@x.com", ["status"] = "active" }
        });
        Assert.Contains("\"email\" = $1", result.Text);
        Assert.Contains("\"status\" = $2", result.Text);
    }

    [Fact]
    public void Filter_EmptyArrayForm_ProducesNoOutput()
    {
        var result = _builder.Build(MakeFilterQuery(), new()
        {
            ["filter"] = new object?[] { }
        });
        Assert.Equal("SELECT * WHERE ", result.Text);
    }

    [Fact]
    public void Filter_WithPrefixAndSuffix()
    {
        var query = new QueryDefinition
        {
            Name = "test", Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT * " },
                new FilterNode
                {
                    Param = "filter", Prefix = "WHERE ", Suffix = " AND 1=1",
                    Columns = new() { ["email"] = "\"email\"" }
                }
            }
        };
        var result = _builder.Build(query, new()
        {
            ["filter"] = new object?[] { new Dictionary<string, object?> { ["email"] = "x@y.com" } }
        });
        Assert.Contains("WHERE \"email\" = $1 AND 1=1", result.Text);
    }
}
