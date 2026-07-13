using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

public class SqlSelectCommandTests
{
    private QueryDefinition MakeQuery() => new()
    {
        Name = "test", Hash = "abc",
        Row = new()
        {
            ["isActive"] = new ColumnSchema { Type = "boolean" },
            ["email"] = new ColumnSchema { Type = "text" },
        },
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
                    ["isActive"] = "\"a\".\"is_active\"",
                },
            },
            new TextNode { Value = " FROM \"account\" AS \"a\"" },
        }
    };

    [Fact]
    public void Build_WithoutProjection_ProducesAllColumns()
    {
        var cmd = new SqlSelectCommand(MakeQuery(), "postgresql");
        var result = cmd.Build(new Dictionary<string, object?>());

        Assert.Contains("\"a\".\"account_id\"", result.Text);
        Assert.Contains("\"a\".\"email\"", result.Text);
        Assert.Contains("\"a\".\"is_active\"", result.Text);
    }

    [Fact]
    public void Build_WithProjection_ProducesSelectedColumns()
    {
        var cmd = new SqlSelectCommand(MakeQuery(), "postgresql");
        var parameters = new Dictionary<string, object?>
        {
            ["select"] = new object?[] { "email", new object?[] { "count", "*", "total" } }
        };
        var result = cmd.Build(parameters);

        Assert.Contains("\"a\".\"email\"", result.Text);
        Assert.Contains("count(*) as \"total\"", result.Text);
    }

    [Fact]
    public void TransformAggregateColumn_BaseClass_ReturnsUnchanged()
    {
        var cmd = new SqlSelectCommand(MakeQuery(), "postgresql");
        var transformed = cmd.TransformAggregateColumn("sum", "\"a\".\"is_active\"", "boolean");

        Assert.Equal("\"a\".\"is_active\"", transformed);
    }
}

public class PostgresSqlSelectCommandTests
{
    private QueryDefinition MakeQuery() => new()
    {
        Name = "test", Hash = "abc",
        Row = new()
        {
            ["isActive"] = new ColumnSchema { Type = "boolean" },
            ["email"] = new ColumnSchema { Type = "text" },
        },
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
                    ["isActive"] = "\"a\".\"is_active\"",
                },
            },
            new TextNode { Value = " FROM \"account\" AS \"a\"" },
        }
    };

    [Fact]
    public void SumOnBoolean_AppendsCastInt()
    {
        var cmd = new Vexnor.Postgres.PostgresSqlSelectCommand(MakeQuery());
        var parameters = new Dictionary<string, object?>
        {
            ["select"] = new object?[] { new object?[] { "sum", "isActive", "activeCount" } }
        };
        var result = cmd.Build(parameters);

        Assert.Contains("::int", result.Text);
    }

    [Fact]
    public void AvgOnBoolean_AppendsCastInt()
    {
        var cmd = new Vexnor.Postgres.PostgresSqlSelectCommand(MakeQuery());
        var parameters = new Dictionary<string, object?>
        {
            ["select"] = new object?[] { new object?[] { "avg", "isActive", "avgActive" } }
        };
        var result = cmd.Build(parameters);

        Assert.Contains("::int", result.Text);
    }

    [Fact]
    public void CountOnBoolean_DoesNotCast()
    {
        var cmd = new Vexnor.Postgres.PostgresSqlSelectCommand(MakeQuery());
        var parameters = new Dictionary<string, object?>
        {
            ["select"] = new object?[] { new object?[] { "count", "isActive", "countActive" } }
        };
        var result = cmd.Build(parameters);

        Assert.DoesNotContain("::int", result.Text);
    }

    [Fact]
    public void SumOnNonBoolean_DoesNotCast()
    {
        var cmd = new Vexnor.Postgres.PostgresSqlSelectCommand(MakeQuery());
        var parameters = new Dictionary<string, object?>
        {
            ["select"] = new object?[] { new object?[] { "sum", "email", "totalEmail" } }
        };
        var result = cmd.Build(parameters);

        Assert.DoesNotContain("::int", result.Text);
    }

    [Fact]
    public void SumOnColumnNotInRowSchema_DoesNotCast()
    {
        // accountId is in Columns but NOT in Row schema — colType will be null
        var cmd = new Vexnor.Postgres.PostgresSqlSelectCommand(MakeQuery());
        var parameters = new Dictionary<string, object?>
        {
            ["select"] = new object?[] { new object?[] { "sum", "accountId", "totalAccounts" } }
        };
        var result = cmd.Build(parameters);

        Assert.DoesNotContain("::int", result.Text);
    }
}


public class QueryRegistryAggregateTransformTests
{
    private QueryManifest MakeManifest() => new()
    {
        Version = 1,
        Dialect = "postgresql",
        Queries = new()
        {
            ["abc"] = new QueryDefinition
            {
                Name = "test", Hash = "abc",
                Row = new()
                {
                    ["isActive"] = new ColumnSchema { Type = "boolean" },
                    ["email"] = new ColumnSchema { Type = "text" },
                },
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
                            ["isActive"] = "\"a\".\"is_active\"",
                        },
                    },
                    new TextNode { Value = " FROM \"account\" AS \"a\"" },
                }
            },
        },
    };

    [Fact]
    public void PostgresRegistry_AppliesBooleanCast_OnSumAggregate()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(MakeManifest());

        var parameters = new Dictionary<string, object?>
        {
            ["select"] = new object?[] { new object?[] { "sum", "isActive", "activeCount" } }
        };
        var result = registry.Build("abc", parameters);

        Assert.Contains("::int", result.Text);
        Assert.Contains("sum(\"a\".\"is_active\"::int) as \"activeCount\"", result.Text);
    }

    [Fact]
    public void PostgresRegistry_AppliesBooleanCast_OnAvgAggregate()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(MakeManifest());

        var parameters = new Dictionary<string, object?>
        {
            ["select"] = new object?[] { new object?[] { "avg", "isActive", "avgActive" } }
        };
        var result = registry.Build("abc", parameters);

        Assert.Contains("avg(\"a\".\"is_active\"::int) as \"avgActive\"", result.Text);
    }

    [Fact]
    public void PostgresRegistry_DoesNotCast_CountOnBoolean()
    {
        var registry = new QueryRegistry("postgresql");
        registry.Load(MakeManifest());

        var parameters = new Dictionary<string, object?>
        {
            ["select"] = new object?[] { new object?[] { "count", "isActive", "countActive" } }
        };
        var result = registry.Build("abc", parameters);

        Assert.DoesNotContain("::int", result.Text);
    }

    [Fact]
    public void MssqlRegistry_DoesNotCast()
    {
        var registry = new QueryRegistry("transactsql");
        registry.Load(MakeManifest());

        var parameters = new Dictionary<string, object?>
        {
            ["select"] = new object?[] { new object?[] { "sum", "isActive", "activeCount" } }
        };
        var result = registry.Build("abc", parameters);

        Assert.DoesNotContain("::int", result.Text);
    }
}
