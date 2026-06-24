using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

public class SqlBuilderValidationTests
{
    private readonly SqlBuilder _builder = new("postgresql");

    // ─── OrderBy validation ──────────────────────────────────────────────────

    [Fact]
    public void OrderBy_InvalidField_Throws()
    {
        var query = new QueryDefinition
        {
            Name = "test", Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT * FROM t " },
                new OrderByNode { Param = "orderBy", Columns = new() { ["email"] = "\"email\"", ["name"] = "\"name\"" } }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["orderBy"] = new Dictionary<string, object?> { ["hackedColumn"] = "ASC" } }));
        Assert.Contains("Invalid orderBy field", ex.Message);
        Assert.Contains("hackedColumn", ex.Message);
        Assert.Contains("email", ex.Message);
    }

    [Fact]
    public void OrderBy_InvalidDirection_Throws()
    {
        var query = new QueryDefinition
        {
            Name = "test", Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT * FROM t " },
                new OrderByNode { Param = "orderBy", Columns = new() { ["email"] = "\"email\"" } }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["orderBy"] = new Dictionary<string, object?> { ["email"] = "DROP TABLE" } }));
        Assert.Contains("Invalid orderBy direction", ex.Message);
        Assert.Contains("DROP TABLE", ex.Message);
    }

    [Fact]
    public void OrderBy_ValidField_And_Direction_Works()
    {
        var query = new QueryDefinition
        {
            Name = "test", Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT * FROM t " },
                new OrderByNode { Param = "orderBy", Columns = new() { ["email"] = "\"email\"" } }
            }
        };

        var result = _builder.Build(query, new() { ["orderBy"] = new Dictionary<string, object?> { ["email"] = "desc" } });
        Assert.Contains("order by \"email\" DESC", result.Text);
    }

    // ─── Filter validation ───────────────────────────────────────────────────

    [Fact]
    public void Filter_InvalidColumn_Throws()
    {
        var query = new QueryDefinition
        {
            Name = "test", Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT * WHERE " },
                new FilterNode { Param = "filter", Columns = new() { ["email"] = "\"email\"", ["status"] = "\"status\"" } }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new()
            {
                ["filter"] = new object?[] { new Dictionary<string, object?> { ["hackedColumn"] = "value" } }
            }));
        Assert.Contains("Invalid filter column", ex.Message);
        Assert.Contains("hackedColumn", ex.Message);
        Assert.Contains("email", ex.Message);
    }

    [Fact]
    public void Filter_InvalidOperator_Throws()
    {
        var query = new QueryDefinition
        {
            Name = "test", Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT * WHERE " },
                new FilterNode { Param = "filter", Columns = new() { ["email"] = "\"email\"" } }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new()
            {
                ["filter"] = new object?[] { new Dictionary<string, object?> { ["email"] = new object?[] { "dropTable", "x" } } }
            }));
        Assert.Contains("Invalid filter operator", ex.Message);
        Assert.Contains("dropTable", ex.Message);
    }

    // ─── Projection validation ───────────────────────────────────────────────

    [Fact]
    public void Projection_InvalidColumn_Throws()
    {
        var query = new QueryDefinition
        {
            Name = "test", Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT " },
                new ProjectionNode { Param = "select", Columns = new() { ["email"] = "\"email\"", ["name"] = "\"name\"" } },
                new TextNode { Value = " FROM t" },
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["select"] = new object?[] { "hackedColumn" } }));
        Assert.Contains("Invalid projection column", ex.Message);
        Assert.Contains("hackedColumn", ex.Message);
    }

    [Fact]
    public void Projection_InvalidAggregateFunction_Throws()
    {
        var query = new QueryDefinition
        {
            Name = "test", Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT " },
                new ProjectionNode { Param = "select", Columns = new() { ["email"] = "\"email\"" } },
                new TextNode { Value = " FROM t" },
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["select"] = new object?[] { new object?[] { "dropTable", "*", "alias" } } }));
        Assert.Contains("Invalid aggregate function", ex.Message);
        Assert.Contains("dropTable", ex.Message);
    }

    [Fact]
    public void Projection_InvalidColumnInAggregate_Throws()
    {
        var query = new QueryDefinition
        {
            Name = "test", Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT " },
                new ProjectionNode { Param = "select", Columns = new() { ["email"] = "\"email\"" } },
                new TextNode { Value = " FROM t" },
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["select"] = new object?[] { new object?[] { "sum", "hackedColumn", "total" } } }));
        Assert.Contains("Invalid projection column in aggregate", ex.Message);
        Assert.Contains("hackedColumn", ex.Message);
    }
}
