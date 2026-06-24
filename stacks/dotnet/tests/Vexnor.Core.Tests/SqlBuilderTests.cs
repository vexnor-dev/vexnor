using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

public class SqlBuilderTests
{
    private readonly SqlBuilder _builder = new("postgresql");

    [Fact]
    public void Build_TextOnly_ReturnsStaticSql()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT * FROM account" }
            }
        };

        var result = _builder.Build(query, new());

        Assert.Equal("SELECT * FROM account", result.Text);
        Assert.Empty(result.Values);
    }

    [Fact]
    public void Build_WithParam_EmitsPlaceholder()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            [
                new TextNode { Value = "SELECT * FROM account WHERE email = " },
                new ParamNode { Name = "email" }
            ]
        };

        var result = _builder.Build(query, new() { ["email"] = "jane@test.com" });

        Assert.Equal("SELECT * FROM account WHERE email = $1", result.Text);
        Assert.Single(result.Values);
        Assert.Equal("jane@test.com", result.Values[0]);
    }

    [Fact]
    public void Build_WithArrayParam_ExpandsPlaceholders()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            [
                new TextNode { Value = "SELECT * FROM account WHERE id IN (" },
                new ParamNode { Name = "ids", Array = true },
                new TextNode { Value = ")" }
            ]
        };

        var ids = new object?[] { "a", "b", "c" };
        var result = _builder.Build(query, new() { ["ids"] = ids });

        Assert.Equal("SELECT * FROM account WHERE id IN ($1, $2, $3)", result.Text);
        Assert.Equal(3, result.Values.Count);
    }

    [Fact]
    public void Build_WhenTrue_IncludesOnTrueBranch()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            [
                new TextNode { Value = "SELECT * FROM account WHERE 1=1 " },
                new WhenNode
                {
                    Param = "hasEmail",
                    OnTrue = new List<TemplateNode>
                    {
                        new TextNode { Value = "AND email = " },
                        new ParamNode { Name = "email" }
                    }
                }
            ]
        };

        var result = _builder.Build(query, new() { ["hasEmail"] = true, ["email"] = "test@x.com" });

        Assert.Equal("SELECT * FROM account WHERE 1=1 AND email = $1", result.Text);
        Assert.Single(result.Values);
    }

    [Fact]
    public void Build_WhenFalse_OmitsFragment()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            [
                new TextNode { Value = "SELECT * FROM account WHERE 1=1 " },
                new WhenNode
                {
                    Param = "hasEmail",
                    OnTrue = new List<TemplateNode>
                    {
                        new TextNode { Value = "AND email = " },
                        new ParamNode { Name = "email" }
                    }
                }
            ]
        };

        var result = _builder.Build(query, new() { ["hasEmail"] = false });

        Assert.Equal("SELECT * FROM account WHERE 1=1 ", result.Text);
        Assert.Empty(result.Values);
    }

    [Fact]
    public void Build_Set_EmitsSetClause()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            [
                new TextNode { Value = "UPDATE account " },
                new SetNode
                {
                    Param = "set",
                    Columns = new() { ["email"] = "\"email\"", ["firstName"] = "\"first_name\"" }
                }
            ]
        };

        var setValues = new Dictionary<string, object?> { ["email"] = "new@test.com", ["firstName"] = "Jane" };
        var result = _builder.Build(query, new() { ["set"] = setValues });

        Assert.Equal("UPDATE account set \"email\" = $1, \"first_name\" = $2", result.Text);
        Assert.Equal(2, result.Values.Count);
        Assert.Equal("new@test.com", result.Values[0]);
        Assert.Equal("Jane", result.Values[1]);
    }

    [Fact]
    public void Build_Insert_EmitsColsAndValues()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            [
                new TextNode { Value = "INSERT INTO account " },
                new InsertNode
                {
                    Param = "rows",
                    Columns = new() { ["email"] = "\"email\"", ["firstName"] = "\"first_name\"" }
                }
            ]
        };

        var rows = new List<Dictionary<string, object?>>
        {
            new() { ["email"] = "a@test.com", ["firstName"] = "A" },
            new() { ["email"] = "b@test.com", ["firstName"] = "B" }
        };
        var result = _builder.Build(query, new() { ["rows"] = rows });

        Assert.Equal("INSERT INTO account (\"email\", \"first_name\") values ($1, $2), ($3, $4)", result.Text);
        Assert.Equal(4, result.Values.Count);
    }

    [Fact]
    public void Build_Filter_EmitsAndSeparatedConditions()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT * FROM account WHERE " },
                new FilterNode
                {
                    Param = "filter",
                    Columns = new() { ["email"] = "\"email\"", ["status"] = "\"status\"" }
                }
            }
        };

        var filter = new Dictionary<string, object?> { ["email"] = "jane@test.com", ["status"] = "active" };
        var result = _builder.Build(query, new() { ["filter"] = filter });

        Assert.Equal("SELECT * FROM account WHERE \"email\" = $1 and \"status\" = $2", result.Text);
        Assert.Equal(2, result.Values.Count);
    }

    [Fact]
    public void Build_OrderBy_EmitsOrderClause()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT * FROM account " },
                new OrderByNode
                {
                    Param = "orderBy",
                    
                    Columns = new() { ["email"] = "\"email\"", ["createdAt"] = "\"created_at\"" }
                }
            }
        };

        var result = _builder.Build(query, new() { ["orderBy"] = new Dictionary<string, object?> { ["createdAt"] = "desc" } });

        Assert.Equal("SELECT * FROM account order by \"created_at\" DESC", result.Text);
        Assert.Empty(result.Values);
    }
}

public class ManifestLoaderTests
{
    [Fact]
    public void Load_ValidJson_DeserializesManifest()
    {
        var json = """
                   {
                       "version": 1,
                       "dialect": "postgresql",
                       "queries": {
                           "abc123": {
                               "name": "findAccounts",
                               "location": "src/queries.ts:5",
                               "hash": "abc123",
                               "template": [
                                   { "type": "text", "value": "SELECT * FROM account WHERE email = " },
                                   { "type": "param", "name": "email" }
                               ],
                               "params": {
                                   "email": { "name": "email", "isContext": false }
                               },
                               "row": null,
                               "authorization": []
                           }
                       }
                   }
                   """;

        var manifest = ManifestLoader.Load(json);

        Assert.Equal(1, manifest.Version);
        Assert.Equal("postgresql", manifest.Dialect);
        Assert.Single(manifest.Queries);
        Assert.True(manifest.Queries.ContainsKey("abc123"));
        Assert.Equal("findAccounts", manifest.Queries["abc123"].Name);
        Assert.Equal(2, manifest.Queries["abc123"].Template.Count);
    }
}

public class QueryRegistryTests
{
    [Fact]
    public void Build_RegisteredQuery_ReturnsSql()
    {
        var registry = new QueryRegistry("postgresql");
        var manifest = new QueryManifest
        {
            Version = 1,
            Dialect = "postgresql",
            Queries = new()
            {
                ["hash1"] = new QueryDefinition
                {
                    Name = "findByEmail",
                    Hash = "hash1",
                    Template =
                    {
                        new TextNode { Value = "SELECT * FROM account WHERE email = " },
                        new ParamNode { Name = "email" }
                    }
                }
            }
        };

        registry.Load(manifest);
        var result = registry.Build("hash1", new() { ["email"] = "test@test.com" });

        Assert.Equal("SELECT * FROM account WHERE email = $1", result.Text);
        Assert.Single(result.Values);
    }

    [Fact]
    public void Build_UnknownHash_Throws()
    {
        var registry = new QueryRegistry("postgresql");

        Assert.Throws<InvalidOperationException>(() =>
            registry.Build("unknown", new()));
    }
}

public class SqlBuilderEdgeCaseTests
{
    private readonly SqlBuilder _builder = new("postgresql");

    [Fact]
    public void Build_WhenFalse_WithElseBranch_IncludesOnFalse()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new TextNode { Value = "ORDER BY created_at " },
                new WhenNode
                {
                    Param = "sortAsc",
                    OnTrue = new List<TemplateNode> { new TextNode { Value = "ASC" } },
                    OnFalse = new List<TemplateNode> { new TextNode { Value = "DESC" } }
                }
            }
        };

        var result = _builder.Build(query, new() { ["sortAsc"] = false });
        Assert.Equal("ORDER BY created_at DESC", result.Text);
    }

    [Fact]
    public void Build_WhenNegate_TrueParam_ExcludesOnTrue()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT * FROM account " },
                new WhenNode
                {
                    Param = "hasEmail",
                    Negate = true,
                    OnTrue = new List<TemplateNode> { new TextNode { Value = "WHERE email IS NULL" } }
                }
            }
        };

        var result = _builder.Build(query, new() { ["hasEmail"] = true });
        Assert.Equal("SELECT * FROM account ", result.Text);
    }

    [Fact]
    public void Build_WhenNegate_FalseParam_IncludesOnTrue()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT * FROM account " },
                new WhenNode
                {
                    Param = "hasEmail",
                    Negate = true,
                    OnTrue = new List<TemplateNode> { new TextNode { Value = "WHERE email IS NULL" } }
                }
            }
        };

        var result = _builder.Build(query, new() { ["hasEmail"] = false });
        Assert.Equal("SELECT * FROM account WHERE email IS NULL", result.Text);
    }

    [Fact]
    public void Build_WhenNegate_WithElseBranch()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT * " },
                new WhenNode
                {
                    Param = "isAdmin",
                    Negate = true,
                    OnTrue = new List<TemplateNode> { new TextNode { Value = "/* not admin */" } },
                    OnFalse = new List<TemplateNode> { new TextNode { Value = "/* is admin */" } }
                }
            }
        };

        var trueResult = _builder.Build(query, new() { ["isAdmin"] = true });
        Assert.Equal("SELECT * /* is admin */", trueResult.Text);

        var falseResult = _builder.Build(query, new() { ["isAdmin"] = false });
        Assert.Equal("SELECT * /* not admin */", falseResult.Text);
    }

    [Fact]
    public void Build_Set_EmptyObject_Throws()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new TextNode { Value = "UPDATE account " },
                new SetNode { Param = "set", Columns = new() { ["email"] = "\"email\"" } }
            }
        };

        Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["set"] = new Dictionary<string, object?>() }));
    }

    [Fact]
    public void Build_Set_MissingParam_Throws()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new TextNode { Value = "UPDATE account " },
                new SetNode { Param = "set", Columns = new() { ["email"] = "\"email\"" } }
            }
        };

        Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new()));
    }

    [Fact]
    public void Build_Set_SkipsUnknownColumns()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new SetNode { Param = "set", Columns = new() { ["email"] = "\"email\"" } }
            }
        };

        var setValues = new Dictionary<string, object?> { ["email"] = "a@b.com", ["unknown"] = "x" };
        var result = _builder.Build(query, new() { ["set"] = setValues });
        Assert.Equal("set \"email\" = $1", result.Text);
        Assert.Single(result.Values);
    }

    [Fact]
    public void Build_Insert_EmptyRows_Throws()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new InsertNode { Param = "rows", Columns = new() { ["email"] = "\"email\"" } }
            }
        };

        Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["rows"] = new List<Dictionary<string, object?>>() }));
    }

    [Fact]
    public void Build_Filter_EmptyObject_ProducesNoOutput()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new FilterNode { Param = "filter", Columns = new() { ["email"] = "\"email\"" } }
            }
        };

        var result = _builder.Build(query, new() { ["filter"] = new Dictionary<string, object?>() });
        Assert.Equal("", result.Text);
    }

    [Fact]
    public void Build_Filter_SkipsNullValues()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new FilterNode { Param = "filter", Columns = new() { ["email"] = "\"email\"", ["name"] = "\"name\"" } }
            }
        };

        var filter = new Dictionary<string, object?> { ["email"] = "a@b.com", ["name"] = null };
        var result = _builder.Build(query, new() { ["filter"] = filter });
        Assert.Equal("\"email\" = $1", result.Text);
        Assert.Single(result.Values);
    }

    [Fact]
    public void Build_Filter_WithPrefixAndSuffix()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new FilterNode
                {
                    Param = "filter", Columns = new() { ["email"] = "\"email\"" }, Prefix = "where ", Suffix = " and"
                }
            }
        };

        var filter = new Dictionary<string, object?> { ["email"] = "a@b.com" };
        var result = _builder.Build(query, new() { ["filter"] = filter });
        Assert.Equal("where \"email\" = $1 and", result.Text);
    }

    [Fact]
    public void Build_OrderBy_EmptyField_ProducesNoOutput()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new OrderByNode { Param = "orderBy", Columns = new() { ["email"] = "\"email\"" } }
            }
        };

        var result = _builder.Build(query, new() { ["orderBy"] = new Dictionary<string, object?> {} });
        Assert.Equal("", result.Text);
    }

    [Fact]
    public void Build_OrderBy_InvalidColumn_Throws()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new OrderByNode { Param = "orderBy", Columns = new() { ["email"] = "\"email\"" } }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["orderBy"] = new Dictionary<string, object?> { ["unknown"] = "asc" } }));
        Assert.Contains("Invalid orderBy field", ex.Message);
    }

    [Fact]
    public void Build_OrderBy_DefaultsToAsc()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new OrderByNode { Param = "orderBy", Columns = new() { ["email"] = "\"email\"" } }
            }
        };

        var result = _builder.Build(query, new() { ["orderBy"] = new Dictionary<string, object?> { ["email"] = null } });
        Assert.Equal("order by \"email\" ASC", result.Text);
    }

    [Fact]
    public void Build_InsertCols_EmitsColumnsOnly()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new TextNode { Value = "(" },
                new InsertColsNode
                    { Param = "rows", Columns = new() { ["email"] = "\"email\"", ["name"] = "\"name\"" } },
                new TextNode { Value = ")" }
            }
        };

        var rows = new List<Dictionary<string, object?>> { new() { ["email"] = "a", ["name"] = "b" } };
        var result = _builder.Build(query, new() { ["rows"] = rows });
        Assert.Equal("(\"email\", \"name\")", result.Text);
        Assert.Empty(result.Values);
    }

    [Fact]
    public void Build_InsertValues_EmitsValuesOnly()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new InsertValuesNode { Param = "rows", Keys = new() { "email", "name" } }
            }
        };

        var rows = new List<Dictionary<string, object?>>
        {
            new() { ["email"] = "a@b.com", ["name"] = "A" },
            new() { ["email"] = "c@d.com", ["name"] = "C" }
        };
        var result = _builder.Build(query, new() { ["rows"] = rows });
        Assert.Equal("($1, $2), ($3, $4)", result.Text);
        Assert.Equal(4, result.Values.Count);
    }

    [Fact]
    public void Build_ValueNode_EmitsPlaceholder()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT * WHERE status = " },
                new ValueNode { Value = "active" }
            }
        };

        var result = _builder.Build(query, new());
        Assert.Equal("SELECT * WHERE status = $1", result.Text);
        Assert.Single(result.Values);
        Assert.Equal("active", result.Values[0]);
    }

    [Fact]
    public void Build_Param_MissingFromParams_ProducesNoOutput()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new TextNode { Value = "WHERE x = " },
                new ParamNode { Name = "missing" }
            }
        };

        var result = _builder.Build(query, new());
        Assert.Equal("WHERE x = $1", result.Text);
        Assert.Single(result.Values);
        Assert.Null(result.Values[0]);
    }

    [Fact]
    public void Build_SqlDialect_UsesQuestionMark()
    {
        var sqliteBuilder = new SqlBuilder("sqlite");
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            {
                new TextNode { Value = "SELECT * WHERE id = " },
                new ParamNode { Name = "id" }
            }
        };

        var result = sqliteBuilder.Build(query, new() { ["id"] = 1 });
        Assert.Equal("SELECT * WHERE id = ?", result.Text);
    }
}