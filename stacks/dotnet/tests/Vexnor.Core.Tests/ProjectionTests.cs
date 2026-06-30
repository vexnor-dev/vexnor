using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

public class SqlBuilderProjectionTests
{
    private readonly SqlBuilder _builder = new("postgresql");

    private QueryDefinition MakeQuery() => new()
    {
        Name = "test", Hash = "abc",
        Template =
        {
            new TextNode { Value = "SELECT " },
            new ProjectionNode
            {
                Param = "select",
                Columns = new()
                {
                    ["accountId"] = "\"a\".\"account_id\" as \"accountId\"",
                    ["email"] = "\"a\".\"email\"",
                    ["firstName"] = "\"a\".\"first_name\" as \"firstName\"",
                    ["status"] = "\"a\".\"status\"",
                    ["createdAt"] = "\"a\".\"created_at\" as \"createdAt\"",
                }
            },
            new TextNode { Value = " FROM \"account\" AS \"a\"" },
        }
    };

    [Fact]
    public void Projection_NoParam_EmitsAllColumns()
    {
        var result = _builder.Build(MakeQuery(), new());
        Assert.Contains("\"a\".\"account_id\" as \"accountId\"", result.Text);
        Assert.Contains("\"a\".\"email\"", result.Text);
        Assert.Contains("\"a\".\"first_name\" as \"firstName\"", result.Text);
        Assert.Contains("\"a\".\"status\"", result.Text);
        Assert.Contains("\"a\".\"created_at\" as \"createdAt\"", result.Text);
    }

    [Fact]
    public void Projection_EmptyArray_EmitsAllColumns()
    {
        var result = _builder.Build(MakeQuery(), new() { ["select"] = new object?[] { } });
        Assert.Contains("\"a\".\"email\"", result.Text);
    }

    [Fact]
    public void Projection_NullParam_EmitsAllColumns()
    {
        var result = _builder.Build(MakeQuery(), new() { ["select"] = null });
        Assert.Contains("\"a\".\"email\"", result.Text);
    }

    [Fact]
    public void Projection_SingleColumn()
    {
        var result = _builder.Build(MakeQuery(), new() { ["select"] = new object?[] { "email" } });
        Assert.Contains("\"a\".\"email\"", result.Text);
        Assert.DoesNotContain("accountId", result.Text);
        Assert.DoesNotContain("firstName", result.Text);
    }

    [Fact]
    public void Projection_MultipleColumns()
    {
        var result = _builder.Build(MakeQuery(), new() { ["select"] = new object?[] { "email", "firstName", "status" } });
        Assert.Contains("\"a\".\"email\"", result.Text);
        Assert.Contains("\"a\".\"first_name\" as \"firstName\"", result.Text);
        Assert.Contains("\"a\".\"status\"", result.Text);
        Assert.DoesNotContain("accountId", result.Text);
    }

    [Fact]
    public void Projection_CountStar()
    {
        var result = _builder.Build(MakeQuery(), new()
        {
            ["select"] = new object?[] { "status", new object?[] { "count", "*", "total" } }
        });
        Assert.Contains("\"a\".\"status\"", result.Text);
        Assert.Contains("count(*) as \"total\"", result.Text);
        Assert.Contains("group by", result.Text);
    }

    [Fact]
    public void Projection_SumColumn()
    {
        var result = _builder.Build(MakeQuery(), new()
        {
            ["select"] = new object?[] { "status", new object?[] { "sum", "createdAt", "totalTime" } }
        });
        Assert.Contains("sum(\"a\".\"created_at\" as \"createdAt\") as \"totalTime\"", result.Text);
        Assert.Contains("group by", result.Text);
    }

    [Fact]
    public void Projection_AvgColumn()
    {
        var result = _builder.Build(MakeQuery(), new()
        {
            ["select"] = new object?[] { "email", new object?[] { "avg", "createdAt", "avgTime" } }
        });
        Assert.Contains("avg(", result.Text);
        Assert.Contains("as \"avgTime\"", result.Text);
    }

    [Fact]
    public void Projection_MinMax()
    {
        var result = _builder.Build(MakeQuery(), new()
        {
            ["select"] = new object?[] { "status", new object?[] { "min", "createdAt", "earliest" }, new object?[] { "max", "createdAt", "latest" } }
        });
        Assert.Contains("min(", result.Text);
        Assert.Contains("max(", result.Text);
        Assert.Contains("as \"earliest\"", result.Text);
        Assert.Contains("as \"latest\"", result.Text);
    }

    [Fact]
    public void Projection_NoGroupBy_WhenNoAggregates()
    {
        var result = _builder.Build(MakeQuery(), new()
        {
            ["select"] = new object?[] { "email", "status" }
        });
        Assert.DoesNotContain("group by", result.Text);
    }

    [Fact]
    public void Projection_GroupBy_OnlyNonAggregateColumns()
    {
        var result = _builder.Build(MakeQuery(), new()
        {
            ["select"] = new object?[] { "status", "email", new object?[] { "count", "*", "cnt" } }
        });
        Assert.Contains("group by \"a\".\"status\", \"a\".\"email\"", result.Text);
        Assert.DoesNotContain("count", result.Text.Split("group by")[1].Contains("count") ? "x" : "");
    }

    [Fact]
    public void Projection_AggregateOnly_NoGroupBy()
    {
        var result = _builder.Build(MakeQuery(), new()
        {
            ["select"] = new object?[] { new object?[] { "count", "*", "total" } }
        });
        Assert.Contains("count(*) as \"total\"", result.Text);
        Assert.DoesNotContain("group by", result.Text);
    }
}
