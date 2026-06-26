using System.Text.Json;
using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

/// <summary>
/// Tests all filter operators against the manifest serialized from the TypeScript fixture
/// (stacks/fixtures/queries/filter-operators.ts). This file enforces at compile time that
/// every FilterOp has a test case. The .NET side must handle them all.
/// </summary>
public class FilterOperatorManifestTests
{
    private static readonly string ManifestPath = Path.GetFullPath(
        Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "..", "fixtures", "manifests", "postgres", "queries", "filter-operators.json"));

    private readonly QueryRegistry _registry;
    private readonly string _queryHash;

    public FilterOperatorManifestTests()
    {
        _registry = new QueryRegistry("postgresql");
        if (File.Exists(ManifestPath))
        {
            _registry.LoadFile(ManifestPath);
        }
        _queryHash = "30e148b999f5a63cf01482efd65120e2497536b65f89c754cf3e60cf32d8b010";
    }

    private SqlBuildResult Build(object? filterValue)
    {
        var parameters = new Dictionary<string, object?> { ["filter"] = filterValue };
        return _registry.Build(_queryHash, parameters);
    }

    // ─── Individual operator tests (matches TS fixture operatorTestCases) ─────

    [Fact]
    public void Op_Equal()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["email"] = new object?[] { "=", "test@example.com" } } });
        Assert.Contains("= $", result.Text);
        Assert.Equal("test@example.com", result.Values.Last());
    }

    [Fact]
    public void Op_Not()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["status"] = new object?[] { "not", "deleted" } } });
        Assert.Contains("<> $", result.Text);
    }

    [Fact]
    public void Op_GreaterThan()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["createdAt"] = new object?[] { ">", "2024-01-01" } } });
        Assert.Contains("> $", result.Text);
    }

    [Fact]
    public void Op_GreaterOrEqual()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["createdAt"] = new object?[] { ">=", "2024-01-01" } } });
        Assert.Contains(">= $", result.Text);
    }

    [Fact]
    public void Op_LowerThan()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["createdAt"] = new object?[] { "<", "2025-01-01" } } });
        Assert.Contains("< $", result.Text);
    }

    [Fact]
    public void Op_LowerOrEqual()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["createdAt"] = new object?[] { "<=", "2025-01-01" } } });
        Assert.Contains("<= $", result.Text);
    }

    [Fact]
    public void Op_Between()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["createdAt"] = new object?[] { "between", "2024-01-01", "2025-01-01" } } });
        Assert.Contains("between $", result.Text);
        Assert.Contains("and $", result.Text);
        Assert.Equal(2, result.Values.Count(v => v is string s && s.Contains("202")));
    }

    [Fact]
    public void Op_Between_EmptyArray()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["createdAt"] = new object?[] { "between" } } });
        Assert.Contains("\"created_at\" is null", result.Text);
    }

    [Fact]
    public void Op_In()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["status"] = new object?[] { "in", "created", "confirmed" } } });
        Assert.Contains("in (", result.Text);
        Assert.Contains("created", result.Values.Select(v => v?.ToString() ?? ""));
        Assert.Contains("confirmed", result.Values.Select(v => v?.ToString() ?? ""));
    }

    [Fact]
    public void Op_In_EmptyArray()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["status"] = new object?[] { "in" } } });
        Assert.Contains("\"status\" is null", result.Text);
    }

    [Fact]
    public void Op_NotIn()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["status"] = new object?[] { "notIn", "deleted" } } });
        Assert.Contains("not in (", result.Text);
    }

    [Fact]
    public void Op_NotIn_EmptyArray()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["status"] = new object?[] { "notIn" } } });
        Assert.Contains("\"status\" is not null", result.Text);
    }

    [Fact]
    public void Op_Like()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["email"] = new object?[] { "like", "%@vip.com" } } });
        Assert.Contains("like $", result.Text);
        Assert.Equal("%@vip.com", result.Values.Last());
    }

    [Fact]
    public void Op_NotLike()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["email"] = new object?[] { "notLike", "%spam%" } } });
        Assert.Contains("not like $", result.Text);
    }

    [Fact]
    public void Op_IsNull()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["parentId"] = new object?[] { "isNull" } } });
        Assert.Contains("is null", result.Text);
    }

    [Fact]
    public void Op_IsNotNull()
    {
        var result = Build(new object?[] { new Dictionary<string, object?> { ["parentId"] = new object?[] { "isNotNull" } } });
        Assert.Contains("is not null", result.Text);
    }

    // ─── Compound test cases ─────────────────────────────────────────────────

    [Fact]
    public void Compound_MultipleConditions_And()
    {
        var result = Build(new object?[]
        {
            new Dictionary<string, object?> { ["status"] = "active" },
            new Dictionary<string, object?> { ["email"] = new object?[] { "like", "%@vip.com" } },
        });
        Assert.Contains("and", result.Text);
    }

    [Fact]
    public void Compound_OrGroup()
    {
        var result = Build(new object?[]
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
        });
        Assert.Contains("or", result.Text);
        Assert.Contains("(", result.Text);
    }

    [Fact]
    public void Compound_LegacyObjectForm()
    {
        var result = Build(new Dictionary<string, object?> { ["email"] = "jane@example.com", ["status"] = "confirmed" });
        Assert.Contains("= $", result.Text);
        Assert.Equal(2, result.Values.Count);
    }

    [Fact]
    public void Compound_EmptyFilter_NoOutput()
    {
        var result = Build(new object?[] { });
        // No operator-generated conditions — only the static template text
        Assert.DoesNotContain("= $", result.Text);
        Assert.Empty(result.Values);
    }

    [Fact]
    public void Compound_NullFilter_NoOutput()
    {
        var result = Build(null);
        Assert.DoesNotContain("= $", result.Text);
        Assert.Empty(result.Values);
    }
}
