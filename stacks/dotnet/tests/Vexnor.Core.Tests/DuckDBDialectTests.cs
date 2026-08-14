using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

public sealed class DuckDBDialectTests
{
    [Fact]
    public void UsesNumberedParameters()
    {
        var query = new QueryDefinition
        {
            Name = "duckdb-parameters",
            Hash = "duckdb-parameters",
            Template =
            [
                new TextNode { Value = "SELECT " },
                new ParamNode { Name = "first" },
                new TextNode { Value = ", " },
                new ParamNode { Name = "second" },
            ],
        };

        var result = new SqlBuilder("duckdb").Build(query, new Dictionary<string, object?>
        {
            ["first"] = "one",
            ["second"] = "two",
        });

        Assert.Equal("SELECT $1, $2", result.Text);
    }
}
