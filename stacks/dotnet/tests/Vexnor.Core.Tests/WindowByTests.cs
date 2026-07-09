using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

public class WindowByTests
{
    private static readonly Dictionary<string, string> AccountColumns = new()
    {
        ["accountId"] = "\"a\".\"account_id\"",
        ["email"] = "\"a\".\"email\"",
        ["firstName"] = "\"a\".\"first_name\"",
        ["status"] = "\"a\".\"status\"",
        ["createdAt"] = "\"a\".\"created_at\"",
        ["total"] = "\"a\".\"total\"",
        ["customerId"] = "\"a\".\"customer_id\"",
    };

    private static QueryDefinition MakeQuery(string dialect = "postgresql") => new()
    {
        Name = "test", Hash = "abc",
        Template =
        {
            new TextNode { Value = "SELECT \"a\".\"account_id\"" },
            new WindowByNode { Param = "windowBy", Columns = AccountColumns },
            new TextNode { Value = " FROM \"account\" AS \"a\"" },
        }
    };

    private static SqlBuildResult Build(object? windowBy, string dialect = "postgresql")
    {
        var builder = new SqlBuilder(dialect);
        return builder.Build(MakeQuery(dialect), new() { ["windowBy"] = windowBy });
    }

    // ─── Ranking functions ───────────────────────────────────────────────────

    [Theory]
    [InlineData("row_number")]
    [InlineData("rank")]
    [InlineData("dense_rank")]
    [InlineData("percent_rank")]
    [InlineData("cume_dist")]
    public void WindowBy_RankingFunctions(string fn)
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["rowNum"] = new Dictionary<string, object?>
            {
                ["fn"] = fn,
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var result = Build(windowBy);
        Assert.Contains($"{fn}() over (order by \"a\".\"created_at\" ASC) as \"rowNum\"", result.Text);
    }

    // ─── Bucket function (ntile) ─────────────────────────────────────────────

    [Fact]
    public void WindowBy_Ntile()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["quartile"] = new Dictionary<string, object?>
            {
                ["fn"] = "ntile",
                ["args"] = 4,
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "DESC" }
                }
            }
        };

        var result = Build(windowBy);
        Assert.Contains("ntile(4) over (order by \"a\".\"created_at\" DESC) as \"quartile\"", result.Text);
    }

    [Fact]
    public void WindowBy_Ntile_MissingArgs_Throws()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["q"] = new Dictionary<string, object?>
            {
                ["fn"] = "ntile",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() => Build(windowBy));
        Assert.Contains("ntile requires 'args'", ex.Message);
    }

    // ─── Aggregate functions ─────────────────────────────────────────────────

    [Theory]
    [InlineData("sum")]
    [InlineData("avg")]
    [InlineData("min")]
    [InlineData("max")]
    [InlineData("first_value")]
    [InlineData("last_value")]
    public void WindowBy_AggregateFunctions(string fn)
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["result"] = new Dictionary<string, object?>
            {
                ["fn"] = fn,
                ["col"] = "total",
                ["over"] = new Dictionary<string, object?>
                {
                    ["partitionBy"] = new object?[] { "customerId" },
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var result = Build(windowBy);
        Assert.Contains($"{fn}(\"a\".\"total\") over (partition by \"a\".\"customer_id\" order by \"a\".\"created_at\" ASC) as \"result\"", result.Text);
    }

    [Fact]
    public void WindowBy_Aggregate_MissingCol_Throws()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["x"] = new Dictionary<string, object?>
            {
                ["fn"] = "sum",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() => Build(windowBy));
        Assert.Contains("aggregate function 'sum' requires 'col'", ex.Message);
    }

    // ─── Count(*) special case ───────────────────────────────────────────────

    [Fact]
    public void WindowBy_CountStar()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["cnt"] = new Dictionary<string, object?>
            {
                ["fn"] = "count",
                ["col"] = "*",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var result = Build(windowBy);
        Assert.Contains("count(*) over (order by \"a\".\"created_at\" ASC) as \"cnt\"", result.Text);
    }
}

public class WindowByOffsetTests
{
    private static readonly Dictionary<string, string> Columns = new()
    {
        ["accountId"] = "\"a\".\"account_id\"",
        ["email"] = "\"a\".\"email\"",
        ["total"] = "\"a\".\"total\"",
        ["createdAt"] = "\"a\".\"created_at\"",
        ["customerId"] = "\"a\".\"customer_id\"",
    };

    private static SqlBuildResult Build(object? windowBy, string dialect = "postgresql")
    {
        var builder = new SqlBuilder(dialect);
        var query = new QueryDefinition
        {
            Name = "test", Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT \"a\".\"account_id\"" },
                new WindowByNode { Param = "windowBy", Columns = Columns },
                new TextNode { Value = " FROM \"account\" AS \"a\"" },
            }
        };
        return builder.Build(query, new() { ["windowBy"] = windowBy });
    }

    [Fact]
    public void WindowBy_Lag_WithArgs()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["prev"] = new Dictionary<string, object?>
            {
                ["fn"] = "lag",
                ["col"] = "total",
                ["args"] = 2,
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var result = Build(windowBy);
        Assert.Contains("lag(\"a\".\"total\", 2) over (order by \"a\".\"created_at\" ASC) as \"prev\"", result.Text);
    }

    [Fact]
    public void WindowBy_Lead_DefaultArgs()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["next"] = new Dictionary<string, object?>
            {
                ["fn"] = "lead",
                ["col"] = "total",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "DESC" }
                }
            }
        };

        var result = Build(windowBy);
        Assert.Contains("lead(\"a\".\"total\", 1) over (order by \"a\".\"created_at\" DESC) as \"next\"", result.Text);
    }

    [Fact]
    public void WindowBy_Offset_MissingCol_Throws()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["x"] = new Dictionary<string, object?>
            {
                ["fn"] = "lag",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() => Build(windowBy));
        Assert.Contains("offset function 'lag' requires 'col'", ex.Message);
    }

    // ─── PARTITION BY ────────────────────────────────────────────────────────

    [Fact]
    public void WindowBy_PartitionBy_Single()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["r"] = new Dictionary<string, object?>
            {
                ["fn"] = "row_number",
                ["over"] = new Dictionary<string, object?>
                {
                    ["partitionBy"] = new object?[] { "customerId" },
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var result = Build(windowBy);
        Assert.Contains("row_number() over (partition by \"a\".\"customer_id\" order by \"a\".\"created_at\" ASC) as \"r\"", result.Text);
    }

    [Fact]
    public void WindowBy_PartitionBy_Multiple()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["r"] = new Dictionary<string, object?>
            {
                ["fn"] = "row_number",
                ["over"] = new Dictionary<string, object?>
                {
                    ["partitionBy"] = new object?[] { "customerId", "email" },
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "DESC" }
                }
            }
        };

        var result = Build(windowBy);
        Assert.Contains("partition by \"a\".\"customer_id\", \"a\".\"email\"", result.Text);
    }

    // ─── ORDER BY ────────────────────────────────────────────────────────────

    [Fact]
    public void WindowBy_OrderBy_Multiple()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["r"] = new Dictionary<string, object?>
            {
                ["fn"] = "rank",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?>
                    {
                        ["customerId"] = "ASC",
                        ["createdAt"] = "DESC"
                    }
                }
            }
        };

        var result = Build(windowBy);
        Assert.Contains("order by \"a\".\"customer_id\" ASC, \"a\".\"created_at\" DESC", result.Text);
    }

    [Fact]
    public void WindowBy_OrderBy_InvalidDirection_Throws()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["r"] = new Dictionary<string, object?>
            {
                ["fn"] = "row_number",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "INVALID" }
                }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() => Build(windowBy));
        Assert.Contains("invalid orderBy direction", ex.Message);
    }

    // ─── FRAME clauses ───────────────────────────────────────────────────────

    [Fact]
    public void WindowBy_Frame_Rows_UnboundedToCurrentRow()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["running"] = new Dictionary<string, object?>
            {
                ["fn"] = "sum",
                ["col"] = "total",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" },
                    ["frame"] = "rows",
                    ["start"] = "unbounded preceding",
                    ["end"] = "current row"
                }
            }
        };

        var result = Build(windowBy);
        Assert.Contains("rows between unbounded preceding and current row", result.Text);
    }

    [Fact]
    public void WindowBy_Frame_Rows_NumericBounds()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["moving"] = new Dictionary<string, object?>
            {
                ["fn"] = "avg",
                ["col"] = "total",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" },
                    ["frame"] = "rows",
                    ["start"] = 3,
                    ["end"] = 0
                }
            }
        };

        var result = Build(windowBy);
        Assert.Contains("rows between 3 preceding and current row", result.Text);
    }

    [Fact]
    public void WindowBy_Frame_Range_UnboundedFollowing()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["x"] = new Dictionary<string, object?>
            {
                ["fn"] = "sum",
                ["col"] = "total",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" },
                    ["frame"] = "range",
                    ["start"] = "current row",
                    ["end"] = "unbounded following"
                }
            }
        };

        var result = Build(windowBy);
        Assert.Contains("range between current row and unbounded following", result.Text);
    }

    [Fact]
    public void WindowBy_Frame_MissingFrameType_Throws()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["x"] = new Dictionary<string, object?>
            {
                ["fn"] = "sum",
                ["col"] = "total",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" },
                    ["start"] = "unbounded preceding",
                    ["end"] = "current row"
                }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() => Build(windowBy));
        Assert.Contains("'frame' (rows|range) is required", ex.Message);
    }
}

public class WindowByMultiAndDialectTests
{
    private static readonly Dictionary<string, string> Columns = new()
    {
        ["accountId"] = "\"a\".\"account_id\"",
        ["email"] = "\"a\".\"email\"",
        ["total"] = "\"a\".\"total\"",
        ["createdAt"] = "\"a\".\"created_at\"",
        ["customerId"] = "\"a\".\"customer_id\"",
    };

    private static SqlBuildResult Build(object? windowBy, string dialect = "postgresql")
    {
        var builder = new SqlBuilder(dialect);
        var query = new QueryDefinition
        {
            Name = "test", Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT \"a\".\"account_id\"" },
                new WindowByNode { Param = "windowBy", Columns = Columns },
                new TextNode { Value = " FROM \"account\" AS \"a\"" },
            }
        };
        return builder.Build(query, new() { ["windowBy"] = windowBy });
    }

    // ─── Multiple window functions in one query ──────────────────────────────

    [Fact]
    public void WindowBy_Multiple_Functions()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["rowNum"] = new Dictionary<string, object?>
            {
                ["fn"] = "row_number",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            },
            ["runningTotal"] = new Dictionary<string, object?>
            {
                ["fn"] = "sum",
                ["col"] = "total",
                ["over"] = new Dictionary<string, object?>
                {
                    ["partitionBy"] = new object?[] { "customerId" },
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            },
            ["prev"] = new Dictionary<string, object?>
            {
                ["fn"] = "lag",
                ["col"] = "total",
                ["args"] = 1,
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var result = Build(windowBy);
        Assert.Contains("row_number() over (order by \"a\".\"created_at\" ASC) as \"rowNum\"", result.Text);
        Assert.Contains("sum(\"a\".\"total\") over (partition by \"a\".\"customer_id\" order by \"a\".\"created_at\" ASC) as \"runningTotal\"", result.Text);
        Assert.Contains("lag(\"a\".\"total\", 1) over (order by \"a\".\"created_at\" ASC) as \"prev\"", result.Text);
    }

    // ─── Combined with projection ───────────────────────────────────────────

    [Fact]
    public void WindowBy_Combined_With_Projection()
    {
        var builder = new SqlBuilder("postgresql");
        var query = new QueryDefinition
        {
            Name = "test", Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT " },
                new ProjectionNode
                {
                    Param = "select",
                    Columns = Columns
                },
                new WindowByNode { Param = "windowBy", Columns = Columns },
                new TextNode { Value = " FROM \"account\" AS \"a\"" },
            }
        };

        var result = builder.Build(query, new()
        {
            ["select"] = new object?[] { "accountId", "total" },
            ["windowBy"] = new Dictionary<string, object?>
            {
                ["rn"] = new Dictionary<string, object?>
                {
                    ["fn"] = "row_number",
                    ["over"] = new Dictionary<string, object?>
                    {
                        ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                    }
                }
            }
        });

        Assert.Contains("\"a\".\"account_id\"", result.Text);
        Assert.Contains("\"a\".\"total\"", result.Text);
        Assert.Contains("row_number() over (order by \"a\".\"created_at\" ASC) as \"rn\"", result.Text);
    }

    // ─── Empty/null windowBy ─────────────────────────────────────────────────

    [Fact]
    public void WindowBy_Null_NoOutput()
    {
        var result = Build(null);
        Assert.Equal("SELECT \"a\".\"account_id\" FROM \"account\" AS \"a\"", result.Text);
    }

    [Fact]
    public void WindowBy_Empty_NoOutput()
    {
        var result = Build(new Dictionary<string, object?>());
        Assert.Equal("SELECT \"a\".\"account_id\" FROM \"account\" AS \"a\"", result.Text);
    }

    [Fact]
    public void WindowBy_MissingParam_NoOutput()
    {
        var builder = new SqlBuilder("postgresql");
        var query = new QueryDefinition
        {
            Name = "test", Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT 1" },
                new WindowByNode { Param = "windowBy", Columns = Columns },
            }
        };
        var result = builder.Build(query, new());
        Assert.Equal("SELECT 1", result.Text);
    }

    // ─── MSSQL dialect: RANGE + numeric bounds throws ────────────────────────

    [Fact]
    public void WindowBy_Mssql_Range_NumericBound_Throws()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["x"] = new Dictionary<string, object?>
            {
                ["fn"] = "sum",
                ["col"] = "total",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" },
                    ["frame"] = "range",
                    ["start"] = 3,
                    ["end"] = "current row"
                }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() => Build(windowBy, "transactsql"));
        Assert.Contains("MSSQL does not support numeric bounds with RANGE frame", ex.Message);
    }

    [Fact]
    public void WindowBy_Mssql_Rows_NumericBound_Works()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["x"] = new Dictionary<string, object?>
            {
                ["fn"] = "sum",
                ["col"] = "total",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" },
                    ["frame"] = "rows",
                    ["start"] = 3,
                    ["end"] = 0
                }
            }
        };

        var result = Build(windowBy, "transactsql");
        Assert.Contains("rows between 3 preceding and current row", result.Text);
    }

    // ─── All 3 dialects ──────────────────────────────────────────────────────

    [Fact]
    public void WindowBy_Postgresql_Dialect()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["r"] = new Dictionary<string, object?>
            {
                ["fn"] = "row_number",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var result = Build(windowBy, "postgresql");
        Assert.Contains("row_number() over (order by \"a\".\"created_at\" ASC) as \"r\"", result.Text);
        Assert.Empty(result.Values);
    }

    [Fact]
    public void WindowBy_Transactsql_Dialect()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["r"] = new Dictionary<string, object?>
            {
                ["fn"] = "row_number",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var result = Build(windowBy, "transactsql");
        Assert.Contains("row_number() over (order by \"a\".\"created_at\" ASC) as \"r\"", result.Text);
        Assert.Empty(result.Values);
    }

    [Fact]
    public void WindowBy_Sqlite_Dialect()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["r"] = new Dictionary<string, object?>
            {
                ["fn"] = "row_number",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var result = Build(windowBy, "sqlite");
        Assert.Contains("row_number() over (order by \"a\".\"created_at\" ASC) as \"r\"", result.Text);
        Assert.Empty(result.Values);
    }

    // ─── Validation errors ───────────────────────────────────────────────────

    [Fact]
    public void WindowBy_InvalidFn_Throws()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["x"] = new Dictionary<string, object?>
            {
                ["fn"] = "invalid_fn",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() => Build(windowBy));
        Assert.Contains("invalid function 'invalid_fn'", ex.Message);
    }

    [Fact]
    public void WindowBy_MissingFn_Throws()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["x"] = new Dictionary<string, object?>
            {
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() => Build(windowBy));
        Assert.Contains("requires a 'fn' property", ex.Message);
    }

    [Fact]
    public void WindowBy_UnknownColumn_FallsBackToQuotedIdentifier()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["r"] = new Dictionary<string, object?>
            {
                ["fn"] = "sum",
                ["col"] = "unknownCol",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var result = Build(windowBy);
        Assert.Contains("sum(\"unknownCol\") over (", result.Text);
    }

    // ─── Column resolution with alias stripping ──────────────────────────────

    [Fact]
    public void WindowBy_Column_StripAlias()
    {
        // When column map has " as \"alias\"" suffix, it should be stripped for window expressions
        var columnsWithAlias = new Dictionary<string, string>
        {
            ["createdAt"] = "\"a\".\"created_at\" as \"createdAt\"",
            ["total"] = "\"a\".\"total\"",
        };

        var builder = new SqlBuilder("postgresql");
        var query = new QueryDefinition
        {
            Name = "test", Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT 1" },
                new WindowByNode { Param = "windowBy", Columns = columnsWithAlias },
            }
        };

        var windowBy = new Dictionary<string, object?>
        {
            ["r"] = new Dictionary<string, object?>
            {
                ["fn"] = "sum",
                ["col"] = "total",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            }
        };

        var result = builder.Build(query, new() { ["windowBy"] = windowBy });
        // Should use "a"."created_at" not "a"."created_at" as "createdAt"
        Assert.Contains("order by \"a\".\"created_at\" ASC", result.Text);
        Assert.DoesNotContain("as \"createdAt\"\" ASC", result.Text);
    }

    // ─── No values emitted (window functions don't produce bind params) ──────

    [Fact]
    public void WindowBy_ProducesNoBindValues()
    {
        var windowBy = new Dictionary<string, object?>
        {
            ["rowNum"] = new Dictionary<string, object?>
            {
                ["fn"] = "row_number",
                ["over"] = new Dictionary<string, object?>
                {
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" }
                }
            },
            ["total"] = new Dictionary<string, object?>
            {
                ["fn"] = "sum",
                ["col"] = "total",
                ["over"] = new Dictionary<string, object?>
                {
                    ["partitionBy"] = new object?[] { "customerId" },
                    ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "ASC" },
                    ["frame"] = "rows",
                    ["start"] = "unbounded preceding",
                    ["end"] = "current row"
                }
            }
        };

        var result = Build(windowBy);
        Assert.Empty(result.Values);
    }
}
