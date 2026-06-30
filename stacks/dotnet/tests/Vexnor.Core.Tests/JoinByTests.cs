using Vexnor.Core.Execution;
using Vexnor.Core.Manifest;
using Xunit;

namespace Vexnor.Core.Tests;

public class JoinByTests
{
    private readonly SqlBuilder _builder = new("postgresql");

    private static JoinByNode MakeJoinByNode(
        string param = "joinBy",
        Dictionary<string, JoinByTableDef>? joinMap = null,
        Dictionary<string, string>? joinTypes = null)
    {
        return new JoinByNode
        {
            Param = param,
            JoinMap = joinMap ?? new(),
            JoinTypes = joinTypes ?? new()
        };
    }

    private static JoinByTableDef MakeTableDef(string schema, string table, Dictionary<string, string> columns)
    {
        return new JoinByTableDef
        {
            Schema = schema,
            Table = table,
            Columns = columns
        };
    }

    private static Dictionary<string, JoinByTableDef> StandardJoinMap() => new()
    {
        ["_"] = MakeTableDef("main", "order", new()
        {
            ["orderId"] = "\"o_1\".\"order_id\"",
            ["status"] = "\"o_1\".\"status\"",
            ["accountId"] = "\"o_1\".\"account_id\""
        }),
        ["account"] = MakeTableDef("main", "account", new()
        {
            ["accountId"] = "\"a_2\".\"account_id\"",
            ["email"] = "\"a_2\".\"email\"",
            ["firstName"] = "\"a_2\".\"first_name\""
        })
    };

    private QueryDefinition MakeQuery(JoinByNode joinByNode)
    {
        return new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            [
                new TextNode { Value = "SELECT * FROM \"main\".\"order\" as \"o_1\" " },
                joinByNode
            ]
        };
    }

    [Fact]
    public void Build_JoinBy_MissingParam_ProducesNoOutput()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var result = _builder.Build(query, new());

        Assert.Equal("SELECT * FROM \"main\".\"order\" as \"o_1\" ", result.Text);
        Assert.Empty(result.Values);
    }

    [Fact]
    public void Build_JoinBy_NullParam_ProducesNoOutput()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var result = _builder.Build(query, new() { ["joinBy"] = null });

        Assert.Equal("SELECT * FROM \"main\".\"order\" as \"o_1\" ", result.Text);
        Assert.Empty(result.Values);
    }

    [Fact]
    public void Build_JoinBy_EmptyObject_ProducesNoOutput()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var result = _builder.Build(query, new() { ["joinBy"] = new Dictionary<string, object?>() });

        Assert.Equal("SELECT * FROM \"main\".\"order\" as \"o_1\" ", result.Text);
        Assert.Empty(result.Values);
    }

    [Fact]
    public void Build_JoinBy_SingleTable_InnerJoin()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[]
                {
                    new object?[] { "_.accountId", "=", "account.accountId" }
                }
            }
        };

        var result = _builder.Build(query, new() { ["joinBy"] = joinByParam });

        Assert.Equal(
            "SELECT * FROM \"main\".\"order\" as \"o_1\"  JOIN \"main\".\"account\" as \"a_2\" ON \"o_1\".\"account_id\" = \"a_2\".\"account_id\"",
            result.Text);
        Assert.Empty(result.Values);
    }

    [Fact]
    public void Build_JoinBy_LeftJoin_FromRuntimeType()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[]
                {
                    new object?[] { "_.accountId", "=", "account.accountId" }
                },
                ["type"] = "left"
            }
        };

        var result = _builder.Build(query, new() { ["joinBy"] = joinByParam });

        Assert.Equal(
            "SELECT * FROM \"main\".\"order\" as \"o_1\"  LEFT JOIN \"main\".\"account\" as \"a_2\" ON \"o_1\".\"account_id\" = \"a_2\".\"account_id\"",
            result.Text);
    }

    [Fact]
    public void Build_JoinBy_LeftJoin_FromJoinTypesDefault()
    {
        var query = MakeQuery(MakeJoinByNode(
            joinMap: StandardJoinMap(),
            joinTypes: new() { ["account"] = "left" }));

        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[]
                {
                    new object?[] { "_.accountId", "=", "account.accountId" }
                }
            }
        };

        var result = _builder.Build(query, new() { ["joinBy"] = joinByParam });

        Assert.Equal(
            "SELECT * FROM \"main\".\"order\" as \"o_1\"  LEFT JOIN \"main\".\"account\" as \"a_2\" ON \"o_1\".\"account_id\" = \"a_2\".\"account_id\"",
            result.Text);
    }

    [Fact]
    public void Build_JoinBy_RuntimeType_OverridesDefault()
    {
        var query = MakeQuery(MakeJoinByNode(
            joinMap: StandardJoinMap(),
            joinTypes: new() { ["account"] = "left" }));

        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[]
                {
                    new object?[] { "_.accountId", "=", "account.accountId" }
                },
                ["type"] = "right"
            }
        };

        var result = _builder.Build(query, new() { ["joinBy"] = joinByParam });

        Assert.Contains("RIGHT JOIN", result.Text);
    }

    [Fact]
    public void Build_JoinBy_MultipleConditions_EmitsAnd()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[]
                {
                    new object?[] { "_.accountId", "=", "account.accountId" },
                    new object?[] { "_.status", "=", "account.accountId" }
                }
            }
        };

        var result = _builder.Build(query, new() { ["joinBy"] = joinByParam });

        Assert.Contains("as \"a_2\" ON \"o_1\".\"account_id\" = \"a_2\".\"account_id\" AND \"o_1\".\"status\" = \"a_2\".\"account_id\"", result.Text);
    }

    [Fact]
    public void Build_JoinBy_MultipleTablesChained()
    {
        var joinMap = new Dictionary<string, JoinByTableDef>
        {
            ["_"] = MakeTableDef("main", "order_item", new()
            {
                ["orderItemId"] = "\"oi_1\".\"order_item_id\"",
                ["orderId"] = "\"oi_1\".\"order_id\""
            }),
            ["order"] = MakeTableDef("main", "order", new()
            {
                ["orderId"] = "\"o_2\".\"order_id\"",
                ["accountId"] = "\"o_2\".\"account_id\""
            }),
            ["account"] = MakeTableDef("main", "account", new()
            {
                ["accountId"] = "\"a_3\".\"account_id\"",
                ["email"] = "\"a_3\".\"email\""
            })
        };

        var node = MakeJoinByNode(joinMap: joinMap, joinTypes: new() { ["account"] = "left" });
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            [
                new TextNode { Value = "SELECT * FROM \"main\".\"order_item\" as \"oi_1\" " },
                node
            ]
        };

        var joinByParam = new Dictionary<string, object?>
        {
            ["order"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[] { new object?[] { "_.orderId", "=", "order.orderId" } }
            },
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[] { new object?[] { "order.accountId", "=", "account.accountId" } }
            }
        };

        var result = _builder.Build(query, new() { ["joinBy"] = joinByParam });

        Assert.Equal(
            "SELECT * FROM \"main\".\"order_item\" as \"oi_1\"  JOIN \"main\".\"order\" as \"o_2\" ON \"oi_1\".\"order_id\" = \"o_2\".\"order_id\" LEFT JOIN \"main\".\"account\" as \"a_3\" ON \"o_2\".\"account_id\" = \"a_3\".\"account_id\"",
            result.Text);
    }

    [Fact]
    public void Build_JoinBy_CrossJoin_NoOnClause()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[] { new object?[] { "_.accountId", "=", "account.accountId" } },
                ["type"] = "cross"
            }
        };

        var result = _builder.Build(query, new() { ["joinBy"] = joinByParam });

        Assert.Equal(
            "SELECT * FROM \"main\".\"order\" as \"o_1\"  CROSS JOIN \"main\".\"account\" as \"a_2\"",
            result.Text);
        Assert.DoesNotContain("ON", result.Text);
    }

    [Fact]
    public void Build_JoinBy_InvalidAlias_Throws()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["nonexistent"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[] { new object?[] { "_.accountId", "=", "nonexistent.id" } }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["joinBy"] = joinByParam }));
        Assert.Contains("Invalid joinBy alias", ex.Message);
        Assert.Contains("nonexistent", ex.Message);
    }

    [Fact]
    public void Build_JoinBy_InvalidJoinType_Throws()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[] { new object?[] { "_.accountId", "=", "account.accountId" } },
                ["type"] = "banana"
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["joinBy"] = joinByParam }));
        Assert.Contains("Invalid join type", ex.Message);
        Assert.Contains("banana", ex.Message);
    }

    [Fact]
    public void Build_JoinBy_InvalidOperator_Throws()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[] { new object?[] { "_.accountId", "LIKE", "account.accountId" } }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["joinBy"] = joinByParam }));
        Assert.Contains("Invalid joinBy ON operator", ex.Message);
        Assert.Contains("LIKE", ex.Message);
    }

    [Fact]
    public void Build_JoinBy_InvalidColumnRef_NoDot_Throws()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[] { new object?[] { "accountId", "=", "account.accountId" } }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["joinBy"] = joinByParam }));
        Assert.Contains("Must be 'alias.column'", ex.Message);
    }

    [Fact]
    public void Build_JoinBy_InvalidColumnRef_UnknownPrefix_Throws()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[] { new object?[] { "unknown.accountId", "=", "account.accountId" } }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["joinBy"] = joinByParam }));
        Assert.Contains("Not found in joinMap", ex.Message);
    }

    [Fact]
    public void Build_JoinBy_InvalidColumnRef_UnknownColumn_Throws()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[] { new object?[] { "_.nonexistent", "=", "account.accountId" } }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["joinBy"] = joinByParam }));
        Assert.Contains("Invalid column: 'nonexistent'", ex.Message);
    }

    [Fact]
    public void Build_JoinBy_MissingOnArray_Throws()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["type"] = "left"
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["joinBy"] = joinByParam }));
        Assert.Contains("requires an 'on' array", ex.Message);
    }

    [Fact]
    public void Build_JoinBy_EmptyOnArray_Throws()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[] { }
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["joinBy"] = joinByParam }));
        Assert.Contains("at least one condition", ex.Message);
    }

    [Fact]
    public void Build_JoinBy_NonArrayOnValue_Throws()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = "not an array"
            }
        };

        var ex = Assert.Throws<InvalidOperationException>(() =>
            _builder.Build(query, new() { ["joinBy"] = joinByParam }));
        Assert.Contains("must be an array", ex.Message);
    }

    [Fact]
    public void Build_JoinBy_CustomParamName()
    {
        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            [
                new TextNode { Value = "SELECT * FROM \"main\".\"order\" as \"o_1\" " },
                MakeJoinByNode(param: "joins", joinMap: StandardJoinMap())
            ]
        };

        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[] { new object?[] { "_.accountId", "=", "account.accountId" } }
            }
        };

        var result = _builder.Build(query, new() { ["joins"] = joinByParam });

        Assert.Contains("JOIN \"main\".\"account\" as \"a_2\"", result.Text);
    }

    [Fact]
    public void Build_JoinBy_EmptySchema_OmitsSchemaPrefix()
    {
        var joinMap = new Dictionary<string, JoinByTableDef>
        {
            ["_"] = MakeTableDef("", "order", new()
            {
                ["orderId"] = "\"o_1\".\"order_id\"",
                ["accountId"] = "\"o_1\".\"account_id\""
            }),
            ["account"] = MakeTableDef("", "account", new()
            {
                ["accountId"] = "\"a_2\".\"account_id\""
            })
        };

        var query = new QueryDefinition
        {
            Name = "test",
            Hash = "abc",
            Template =
            [
                new TextNode { Value = "SELECT * FROM \"order\" " },
                MakeJoinByNode(joinMap: joinMap)
            ]
        };

        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[] { new object?[] { "_.accountId", "=", "account.accountId" } }
            }
        };

        var result = _builder.Build(query, new() { ["joinBy"] = joinByParam });

        Assert.Contains("JOIN \"account\" as \"a_2\"", result.Text);
        Assert.DoesNotContain("\".\"account\"", result.Text);
    }

    [Fact]
    public void Build_JoinBy_ComparisonOperators()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[]
                {
                    new object?[] { "_.accountId", ">=", "account.accountId" }
                }
            }
        };

        var result = _builder.Build(query, new() { ["joinBy"] = joinByParam });

        Assert.Contains(">= \"a_2\".\"account_id\"", result.Text);
    }

    [Fact]
    public void Build_JoinBy_NullEntry_Skipped()
    {
        var query = MakeQuery(MakeJoinByNode(joinMap: StandardJoinMap()));
        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = null
        };

        var result = _builder.Build(query, new() { ["joinBy"] = joinByParam });

        Assert.Equal("SELECT * FROM \"main\".\"order\" as \"o_1\" ", result.Text);
    }
}

public class JoinByManifestTests
{
    [Fact]
    public void Load_JoinByNode_DeserializesCorrectly()
    {
        var json = """
                   {
                       "version": 1,
                       "dialect": "postgresql",
                       "queries": {
                           "hash1": {
                               "name": "ordersWithJoin",
                               "hash": "hash1",
                               "template": [
                                   { "type": "text", "value": "SELECT * FROM \"main\".\"order\" as \"o_1\" " },
                                   {
                                       "type": "joinBy",
                                       "param": "joinBy",
                                       "joinMap": {
                                           "_": {
                                               "schema": "main",
                                               "table": "order",
                                               "columns": {
                                                   "orderId": "\"o_1\".\"order_id\"",
                                                   "accountId": "\"o_1\".\"account_id\""
                                               }
                                           },
                                           "account": {
                                               "schema": "main",
                                               "table": "account",
                                               "columns": {
                                                   "accountId": "\"a_2\".\"account_id\"",
                                                   "email": "\"a_2\".\"email\""
                                               }
                                           }
                                       },
                                       "joinTypes": { "account": "left" }
                                   }
                               ],
                               "params": {},
                               "row": null,
                               "authorization": []
                           }
                       }
                   }
                   """;

        var manifest = ManifestLoader.Load(json);
        Assert.Single(manifest.Queries);

        var query = manifest.Queries["hash1"];
        Assert.Equal(2, query.Template.Count);

        var joinByNode = query.Template[1] as JoinByNode;
        Assert.NotNull(joinByNode);
        Assert.Equal("joinBy", joinByNode!.Param);
        Assert.Equal(2, joinByNode.JoinMap.Count);
        Assert.True(joinByNode.JoinMap.ContainsKey("_"));
        Assert.True(joinByNode.JoinMap.ContainsKey("account"));
        Assert.Equal("main", joinByNode.JoinMap["account"].Schema);
        Assert.Equal("account", joinByNode.JoinMap["account"].Table);
        Assert.Equal("\"a_2\".\"account_id\"", joinByNode.JoinMap["account"].Columns["accountId"]);
        Assert.Single(joinByNode.JoinTypes);
        Assert.Equal("left", joinByNode.JoinTypes["account"]);
    }

    [Fact]
    public void Load_JoinByNode_BuildsCorrectSql()
    {
        var json = """
                   {
                       "version": 1,
                       "dialect": "postgresql",
                       "queries": {
                           "hash1": {
                               "name": "ordersWithJoin",
                               "hash": "hash1",
                               "template": [
                                   { "type": "text", "value": "SELECT * FROM \"main\".\"order\" as \"o_1\" " },
                                   {
                                       "type": "joinBy",
                                       "param": "joinBy",
                                       "joinMap": {
                                           "_": {
                                               "schema": "main",
                                               "table": "order",
                                               "columns": {
                                                   "orderId": "\"o_1\".\"order_id\"",
                                                   "accountId": "\"o_1\".\"account_id\""
                                               }
                                           },
                                           "account": {
                                               "schema": "main",
                                               "table": "account",
                                               "columns": {
                                                   "accountId": "\"a_2\".\"account_id\"",
                                                   "email": "\"a_2\".\"email\""
                                               }
                                           }
                                       },
                                       "joinTypes": {}
                                   }
                               ],
                               "params": {},
                               "row": null,
                               "authorization": []
                           }
                       }
                   }
                   """;

        var registry = new QueryRegistry("postgresql");
        registry.Load(ManifestLoader.Load(json));

        var joinByParam = new Dictionary<string, object?>
        {
            ["account"] = new Dictionary<string, object?>
            {
                ["on"] = new object?[]
                {
                    new object?[] { "_.accountId", "=", "account.accountId" }
                }
            }
        };

        var result = registry.Build("hash1", new() { ["joinBy"] = joinByParam });

        Assert.Equal(
            "SELECT * FROM \"main\".\"order\" as \"o_1\"  JOIN \"main\".\"account\" as \"a_2\" ON \"o_1\".\"account_id\" = \"a_2\".\"account_id\"",
            result.Text);
        Assert.Empty(result.Values);
    }
}
