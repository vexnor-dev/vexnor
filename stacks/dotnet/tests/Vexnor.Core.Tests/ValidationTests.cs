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

    // ─── Legacy dict filter validation ───────────────────────────────────────

    [Fact]
    public async Task Filter_LegacyDict_InvalidColumn_Throws()
    {
        var registry = new QueryRegistry("postgresql");
        var manifest = new QueryManifest();
        manifest.Queries["h1"] = new QueryDefinition
        {
            Name = "test", Hash = "h1",
            Template =
            {
                new TextNode { Value = "SELECT * WHERE " },
                new FilterNode { Param = "filter", Columns = new() { ["email"] = "\"email\"", ["status"] = "\"status\"" } }
            },
            Params = new() { ["filter"] = new ParamDefinition { Name = "filter", Validation = new ParamValidationSchema { Type = "filter", Columns = new() { "email", "status" }, Operators = new() { "=", "like" } } } }
        };
        registry.Load(manifest);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            registry.ExecuteAsync<object?>("h1",
                new() { ["filter"] = new Dictionary<string, object?> { ["hackedColumn"] = "value" } },
                new(),
                _ => Task.FromResult<object?>(null)));
        Assert.Contains("Column not found", ex.Message);
        Assert.Contains("hackedColumn", ex.Message);
    }

    [Fact]
    public async Task Filter_Array_InvalidColumn_ThrowsViaValidation()
    {
        var registry = new QueryRegistry("postgresql");
        var manifest = new QueryManifest();
        manifest.Queries["h1"] = new QueryDefinition
        {
            Name = "test", Hash = "h1",
            Template =
            {
                new TextNode { Value = "SELECT * WHERE " },
                new FilterNode { Param = "filter", Columns = new() { ["email"] = "\"email\"" } }
            },
            Params = new() { ["filter"] = new ParamDefinition { Name = "filter", Validation = new ParamValidationSchema { Type = "filter", Columns = new() { "email" }, Operators = new() { "=", "like" } } } }
        };
        registry.Load(manifest);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            registry.ExecuteAsync<object?>("h1",
                new() { ["filter"] = new object?[] { new Dictionary<string, object?> { ["badCol"] = "x" } } },
                new(),
                _ => Task.FromResult<object?>(null)));
        Assert.Contains("Column not found", ex.Message);
        Assert.Contains("badCol", ex.Message);
    }
}
