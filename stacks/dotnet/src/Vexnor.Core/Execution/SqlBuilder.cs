using System.Linq;
using Vexnor.Core.Manifest;

namespace Vexnor.Core.Execution;

/// <summary>
/// Builds executable SQL from a query template and runtime parameters.
/// Evaluates portable operators (when, set, insert, filter, orderBy) against provided params.
/// </summary>
public sealed class SqlBuilder
{
    private readonly string _dialect;
    private int _paramIndex;
    private AggregateColumnTransform? _aggregateColumnTransform;
    private Dictionary<string, ColumnSchema>? _rowSchema;

    public SqlBuilder(string dialect)
    {
        _dialect = dialect;
    }

    public SqlBuildResult Build(QueryDefinition query, Dictionary<string, object?> parameters)
    {
        return Build(query, parameters, aggregateColumnTransform: null);
    }

    public SqlBuildResult Build(QueryDefinition query, Dictionary<string, object?> parameters, AggregateColumnTransform? aggregateColumnTransform)
    {
        _paramIndex = 0;
        _aggregateColumnTransform = aggregateColumnTransform;
        _rowSchema = query.Row;
        var sql = new List<string>();
        var values = new List<object?>();

        BuildNodes(query.Template, parameters, sql, values);

        _aggregateColumnTransform = null;
        _rowSchema = null;
        return new SqlBuildResult(string.Concat(sql), values);
    }

    private void BuildNodes(List<TemplateNode> nodes, Dictionary<string, object?> parameters, List<string> sql, List<object?> values)
    {
        foreach (var node in nodes)
        {
            switch (node)
            {
                case TextNode text:
                    sql.Add(text.Value);
                    break;

                case ParamNode param:
                    BuildParam(param, parameters, sql, values);
                    break;

                case ValueNode value:
                    sql.Add(FormatParam());
                    values.Add(value.Value);
                    break;

                case WhenNode whenNode:
                    BuildWhen(whenNode, parameters, sql, values);
                    break;

                case SetNode set:
                    BuildSet(set, parameters, sql, values);
                    break;

                case InsertNode insert:
                    BuildInsert(insert, parameters, sql, values);
                    break;

                case InsertColsNode insertCols:
                    BuildInsertCols(insertCols, parameters, sql);
                    break;

                case InsertValuesNode insertValues:
                    BuildInsertValues(insertValues, parameters, sql, values);
                    break;

                case FilterNode filter:
                    BuildFilter(filter, parameters, sql, values);
                    break;

                case OrderByNode orderBy:
                    BuildOrderBy(orderBy, parameters, sql);
                    break;

                case ProjectionNode projection:
                    BuildProjection(projection, parameters, sql, values, _aggregateColumnTransform, _rowSchema);
                    break;

                case PaginationNode:
                    BuildPagination(parameters, sql, values);
                    break;

                case JoinByNode joinBy:
                    BuildJoinBy(joinBy, parameters, sql, values);
                    break;

                case UpsertNode upsert:
                    BuildUpsert(upsert, parameters, sql, values);
                    break;

                case WindowByNode windowBy:
                    BuildWindowBy(windowBy, parameters, sql, values);
                    break;
            }
        }
    }

    private void BuildParam(ParamNode param, Dictionary<string, object?> parameters, List<string> sql, List<object?> values)
    {
        parameters.TryGetValue(param.Name, out var value);

        if (param.Array == true && value is IEnumerable<object?> array)
        {
            var items = array.ToList();
            for (int i = 0; i < items.Count; i++)
            {
                if (i > 0) sql.Add(", ");
                sql.Add(FormatParam());
                values.Add(items[i]);
            }
        }
        else
        {
            sql.Add(FormatParam());
            values.Add(value);
        }
    }

    private void BuildWhen(WhenNode when, Dictionary<string, object?> parameters, List<string> sql, List<object?> values)
    {
        var isPresent = parameters.TryGetValue(when.Param, out var val) && val != null && val is not false;
        var flag = when.Negate ? !isPresent : isPresent;

        if (flag)
            BuildNodes(when.OnTrue, parameters, sql, values);
        else if (when.OnFalse != null)
            BuildNodes(when.OnFalse, parameters, sql, values);
    }

    private void BuildSet(SetNode set, Dictionary<string, object?> parameters, List<string> sql, List<object?> values)
    {
        if (!parameters.TryGetValue(set.Param, out var obj) || obj is not Dictionary<string, object?> dict)
            throw new InvalidOperationException("set() requires a non-empty object");
        if (dict.Count == 0)
            throw new InvalidOperationException("set() requires at least one column");

        sql.Add("set ");
        int emitted = 0;
        foreach (var (key, value) in dict)
        {
            if (!set.Columns.TryGetValue(key, out var colSql)) continue;
            if (emitted > 0) sql.Add(", ");
            sql.Add(colSql);
            sql.Add(" = ");
            sql.Add(FormatParam());
            values.Add(value);
            emitted++;
        }
    }

    private void BuildInsert(InsertNode insert, Dictionary<string, object?> parameters, List<string> sql, List<object?> values)
    {
        if (!parameters.TryGetValue(insert.Param, out var obj)) return;
        var rows = CoerceRowList(obj);
        if (rows == null || rows.Count == 0) throw new InvalidOperationException("insert/upsert requires a non-empty rows array");

        var keys = GetCanonicalKeys(insert.Columns, rows[0]);

        // Columns
        sql.Add("(");
        for (int i = 0; i < keys.Count; i++)
        {
            if (i > 0) sql.Add(", ");
            sql.Add(insert.Columns[keys[i]]);
        }
        sql.Add(") values ");

        // Value tuples
        for (int r = 0; r < rows.Count; r++)
        {
            if (r > 0) sql.Add(", ");
            sql.Add("(");
            for (int i = 0; i < keys.Count; i++)
            {
                if (i > 0) sql.Add(", ");
                sql.Add(FormatParam());
                values.Add(rows[r].GetValueOrDefault(keys[i]));
            }
            sql.Add(")");
        }
    }

    private void BuildInsertCols(InsertColsNode node, Dictionary<string, object?> parameters, List<string> sql)
    {
        if (!parameters.TryGetValue(node.Param, out var obj)) return;
        var rows = CoerceRowList(obj);
        if (rows == null || rows.Count == 0) throw new InvalidOperationException("insert/upsert requires a non-empty rows array");

        var keys = GetCanonicalKeys(node.Columns, rows[0]);
        for (int i = 0; i < keys.Count; i++)
        {
            if (i > 0) sql.Add(", ");
            sql.Add(node.Columns[keys[i]]);
        }
    }

    private void BuildInsertValues(InsertValuesNode node, Dictionary<string, object?> parameters, List<string> sql, List<object?> values)
    {
        if (!parameters.TryGetValue(node.Param, out var obj)) return;
        var rows = CoerceRowList(obj);
        if (rows == null || rows.Count == 0) throw new InvalidOperationException("insert/upsert requires a non-empty rows array");

        var keys = node.Keys.Where(k => rows[0].ContainsKey(k)).ToList();
        for (int r = 0; r < rows.Count; r++)
        {
            if (r > 0) sql.Add(", ");
            sql.Add("(");
            for (int i = 0; i < keys.Count; i++)
            {
                if (i > 0) sql.Add(", ");
                sql.Add(FormatParam());
                values.Add(rows[r].GetValueOrDefault(keys[i]));
            }
            sql.Add(")");
        }
    }

    private void BuildFilter(FilterNode filter, Dictionary<string, object?> parameters, List<string> sql, List<object?> values)
    {
        if (!parameters.TryGetValue(filter.Param, out var obj)) return;

        // Support both legacy object form and extended array form
        List<Dictionary<string, object?>>? conditions;
        if (obj is Dictionary<string, object?> dict)
        {
            // Legacy: { col: value } → convert to array of single-key dicts
            conditions = dict.Where(kv => kv.Value != null)
                .Select(kv => new Dictionary<string, object?> { [kv.Key] = kv.Value })
                .ToList();
        }
        else if (obj is object?[] array)
        {
            conditions = array.OfType<Dictionary<string, object?>>().ToList();
        }
        else return;

        if (conditions.Count == 0) return;

        if (filter.Prefix != null) sql.Add(filter.Prefix);
        WriteConditions(filter, conditions, "and", sql, values);
        if (filter.Suffix != null) sql.Add(filter.Suffix);
    }

    private void WriteConditions(FilterNode filter, List<Dictionary<string, object?>> conditions, string joiner, List<string> sql, List<object?> values)
    {
        int emitted = 0;
        foreach (var condition in conditions)
        {
            if (condition.TryGetValue("or", out var orVal) && orVal is object?[] orArray)
            {
                var orConditions = orArray.OfType<Dictionary<string, object?>>().ToList();
                if (orConditions.Count == 0) continue;
                if (emitted > 0) sql.Add($" {joiner} ");
                sql.Add("(");
                WriteConditions(filter, orConditions, "or", sql, values);
                sql.Add(")");
                emitted++;
            }
            else
            {
                foreach (var (key, value) in condition)
                {
                    if (value == null) continue;
                    if (!filter.Columns.TryGetValue(key, out var colSql))
                        throw new InvalidOperationException(
                            $"Invalid filter column: '{key}'. Allowed: {string.Join(", ", filter.Columns.Keys)}");
                    if (emitted > 0) sql.Add($" {joiner} ");
                    WriteEntry(colSql, value, sql, values);
                    emitted++;
                }
            }
        }
    }

    private static readonly HashSet<string> ValidFilterOps = new()
    {
        "=", "not", ">", ">=", "<", "<=", "!=",
        "between", "in", "notIn", "like", "notLike", "isNull", "isNotNull"
    };

    private void WriteEntry(string colSql, object? value, List<string> sql, List<object?> values)
    {
        if (value is object?[] tuple && tuple.Length >= 1 && tuple[0] is string op)
        {
            if (!ValidFilterOps.Contains(op))
                throw new InvalidOperationException(
                    $"Invalid filter operator: '{op}'. Allowed: {string.Join(", ", ValidFilterOps)}");
            WriteOp(colSql, op, tuple.Skip(1).ToArray(), sql, values);
        }
        else
        {
            // Bare value — equality
            sql.Add(colSql);
            sql.Add(" = ");
            sql.Add(FormatParam());
            values.Add(value);
        }
    }

    private void WriteOp(string colSql, string op, object?[] args, List<string> sql, List<object?> values)
    {
        switch (op)
        {
            case "=":
                sql.Add(colSql); sql.Add(" = "); sql.Add(FormatParam()); values.Add(args[0]);
                break;
            case "not":
            case "!=":
                sql.Add(colSql); sql.Add(" <> "); sql.Add(FormatParam()); values.Add(args[0]);
                break;
            case ">":
                sql.Add(colSql); sql.Add(" > "); sql.Add(FormatParam()); values.Add(args[0]);
                break;
            case ">=":
                sql.Add(colSql); sql.Add(" >= "); sql.Add(FormatParam()); values.Add(args[0]);
                break;
            case "<":
                sql.Add(colSql); sql.Add(" < "); sql.Add(FormatParam()); values.Add(args[0]);
                break;
            case "<=":
                sql.Add(colSql); sql.Add(" <= "); sql.Add(FormatParam()); values.Add(args[0]);
                break;
            case "between":
                if (args.Length < 2) throw new InvalidOperationException(
                    $"'between' operator requires 2 arguments, got {args.Length}");
                sql.Add(colSql); sql.Add(" between "); sql.Add(FormatParam()); values.Add(args[0]);
                sql.Add(" and "); sql.Add(FormatParam()); values.Add(args[1]);
                break;
            case "in":
            {
                var list = args.Length > 0 && args[0] is object?[] arr ? arr : args;
                if (list.Length == 0) { sql.Add("1=0"); break; }
                sql.Add(colSql); sql.Add(" in (");
                for (int i = 0; i < list.Length; i++)
                {
                    if (i > 0) sql.Add(", ");
                    sql.Add(FormatParam()); values.Add(list[i]);
                }
                sql.Add(")");
                break;
            }
            case "notIn":
            {
                var list = args.Length > 0 && args[0] is object?[] arr ? arr : args;
                if (list.Length == 0) { break; }
                sql.Add(colSql); sql.Add(" not in (");
                for (int i = 0; i < list.Length; i++)
                {
                    if (i > 0) sql.Add(", ");
                    sql.Add(FormatParam()); values.Add(list[i]);
                }
                sql.Add(")");
                break;
            }
            case "like":
                sql.Add(colSql); sql.Add(" like "); sql.Add(FormatParam()); values.Add(args[0]);
                break;
            case "notLike":
                sql.Add(colSql); sql.Add(" not like "); sql.Add(FormatParam()); values.Add(args[0]);
                break;
            case "isNull":
                sql.Add(colSql); sql.Add(" is null");
                break;
            case "isNotNull":
                sql.Add(colSql); sql.Add(" is not null");
                break;
            default:
                // Unknown operator — fall back to equality
                sql.Add(colSql); sql.Add(" = "); sql.Add(FormatParam()); values.Add(args.Length > 0 ? args[0] : null);
                break;
        }
    }

    /// <summary>
    /// Delegate for transforming the column SQL inside an aggregate function call.
    /// Called with (functionName, columnSql, columnType) and returns the (possibly transformed) column SQL.
    /// </summary>
    public delegate string AggregateColumnTransform(string fn, string colSql, string? colType);

    internal void BuildProjection(ProjectionNode projection, Dictionary<string, object?> parameters, List<string> sql, List<object?> values,
        AggregateColumnTransform? aggregateColumnTransform, Dictionary<string, ColumnSchema>? rowSchema)
    {
        if (!parameters.TryGetValue(projection.Param, out var obj))
        {
            // No select param — emit all columns
            EmitAllColumns(projection.Columns, sql);
            return;
        }

        if (obj is not object?[] entries || entries.Length == 0)
        {
            // Empty or null — emit all columns
            EmitAllColumns(projection.Columns, sql);
            return;
        }

        var groupByCols = new List<string>();
        var hasAggregate = false;

        for (int i = 0; i < entries.Length; i++)
        {
            if (i > 0) sql.Add(", ");

            if (entries[i] is string colName)
            {
                // Simple column name
                if (!projection.Columns.TryGetValue(colName, out var colSql))
                    throw new InvalidOperationException(
                        $"Invalid projection column: '{colName}'. Allowed: {string.Join(", ", projection.Columns.Keys)}");
                sql.Add(colSql);
                groupByCols.Add(colSql);
            }
            else if (entries[i] is object?[] tuple && tuple.Length >= 3 && tuple[0] is string fn)
            {
                // Aggregate: [fn, colRef, alias]
                hasAggregate = true;
                var colRef = tuple[1];
                var alias = tuple[2] as string ?? "";

                if (fn != "count" && fn != "sum" && fn != "avg" && fn != "min" && fn != "max")
                    throw new InvalidOperationException(
                        $"Invalid aggregate function: '{fn}'. Allowed: count, sum, avg, min, max");

                sql.Add($"{fn}(");
                if (colRef is string s && s == "*")
                {
                    sql.Add("*");
                }
                else if (colRef is string colKey)
                {
                    if (!projection.Columns.TryGetValue(colKey, out var aggColSql))
                        throw new InvalidOperationException(
                            $"Invalid projection column in aggregate: '{colKey}'. Allowed: {string.Join(", ", projection.Columns.Keys)}");

                    // Apply aggregate column transform if provided
                    if (aggregateColumnTransform != null)
                    {
                        string? colType = null;
                        if (rowSchema != null && rowSchema.TryGetValue(colKey, out var schema))
                            colType = schema.Type;
                        aggColSql = aggregateColumnTransform(fn, aggColSql, colType);
                    }

                    sql.Add(aggColSql);
                }
                sql.Add($") as \"{alias}\"");
            }
        }

        // Auto GROUP BY when aggregates are present
        if (hasAggregate && groupByCols.Count > 0)
        {
            sql.Add(" group by ");
            for (int i = 0; i < groupByCols.Count; i++)
            {
                if (i > 0) sql.Add(", ");
                sql.Add(groupByCols[i]);
            }
        }
    }

    private static void EmitAllColumns(Dictionary<string, string> columns, List<string> sql)
    {
        int i = 0;
        foreach (var colSql in columns.Values)
        {
            if (i > 0) sql.Add(", ");
            sql.Add(colSql);
            i++;
        }
    }

    private void BuildOrderBy(OrderByNode orderBy, Dictionary<string, object?> parameters, List<string> sql)
    {
        if (!parameters.TryGetValue(orderBy.Param, out var obj)) return;
        if (obj is not Dictionary<string, object?> entries || entries.Count == 0) return;

        sql.Add("order by ");
        int emitted = 0;
        foreach (var (field, dirObj) in entries)
        {
            if (!orderBy.Columns.TryGetValue(field, out var colSql))
                throw new InvalidOperationException(
                    $"Invalid orderBy field: '{field}'. Allowed fields: {string.Join(", ", orderBy.Columns.Keys)}");

            var dir = dirObj?.ToString()?.ToUpper() ?? "ASC";
            if (dir != "ASC" && dir != "DESC")
                throw new InvalidOperationException(
                    $"Invalid orderBy direction: '{dirObj}'. Must be 'ASC' or 'DESC'.");

            if (emitted > 0) sql.Add(", ");
            sql.Add(colSql);
            sql.Add(" ");
            sql.Add(dir);
            emitted++;
        }
    }

    private static readonly HashSet<string> ValidJoinOps = new()
    {
        "=", "<", "<=", ">", ">=", "<>"
    };

    private static readonly HashSet<string> ValidJoinTypes = new()
    {
        "inner", "left", "right", "full", "cross"
    };

    private void BuildJoinBy(JoinByNode joinBy, Dictionary<string, object?> parameters, List<string> sql, List<object?> values)
    {
        if (!parameters.TryGetValue(joinBy.Param, out var obj)) return;
        if (obj is not Dictionary<string, object?> entries || entries.Count == 0) return;

        foreach (var (alias, entryObj) in entries)
        {
            if (entryObj is not Dictionary<string, object?> entry) continue;

            if (!joinBy.JoinMap.TryGetValue(alias, out var tableDef))
                throw new InvalidOperationException(
                    $"Invalid joinBy alias: '{alias}'. Allowed: {string.Join(", ", joinBy.JoinMap.Keys.Where(k => k != "_"))}");

            // Resolve join type: runtime entry > joinTypes default > "inner"
            var joinType = "inner";
            if (entry.TryGetValue("type", out var typeObj) && typeObj is string typeStr && typeStr.Length > 0)
                joinType = typeStr.ToLower();
            else if (joinBy.JoinTypes.TryGetValue(alias, out var defaultType))
                joinType = defaultType.ToLower();

            if (!ValidJoinTypes.Contains(joinType))
                throw new InvalidOperationException(
                    $"Invalid join type: '{joinType}'. Allowed: {string.Join(", ", ValidJoinTypes)}");

            var keyword = joinType == "inner" ? "JOIN" : $"{joinType.ToUpper()} JOIN";
            var qualifiedTable = string.IsNullOrEmpty(tableDef.Schema)
                ? $"\"{tableDef.Table}\""
                : $"\"{tableDef.Schema}\".\"{tableDef.Table}\"";

            // Extract the SQL alias from the first column value (e.g., "a_2" from "\"a_2\".\"account_id\"")
            var sqlAlias = ExtractAliasFromColumns(tableDef.Columns, alias);

            sql.Add($" {keyword} {qualifiedTable} as {sqlAlias}");

            if (joinType == "cross") continue;

            if (!entry.TryGetValue("on", out var onObj))
                throw new InvalidOperationException(
                    $"joinBy entry '{alias}' requires an 'on' array");

            var conditions = onObj switch
            {
                object?[] arr => arr,
                _ => throw new InvalidOperationException(
                    $"joinBy entry '{alias}' 'on' must be an array of conditions")
            };

            if (conditions.Length == 0)
                throw new InvalidOperationException(
                    $"joinBy entry '{alias}' 'on' must have at least one condition");

            sql.Add(" ON ");

            for (int i = 0; i < conditions.Length; i++)
            {
                if (i > 0) sql.Add(" AND ");

                if (conditions[i] is not object?[] condition || condition.Length < 3)
                    throw new InvalidOperationException(
                        $"joinBy ON condition must be a 3-tuple [leftCol, operator, rightCol]");

                var leftRef = condition[0]?.ToString() ?? "";
                var op = condition[1]?.ToString() ?? "";
                var rightRef = condition[2]?.ToString() ?? "";

                if (!ValidJoinOps.Contains(op))
                    throw new InvalidOperationException(
                        $"Invalid joinBy ON operator: '{op}'. Allowed: {string.Join(", ", ValidJoinOps)}");

                var leftSql = ResolveJoinColRef(leftRef, joinBy.JoinMap);
                var rightSql = ResolveJoinColRef(rightRef, joinBy.JoinMap);

                sql.Add(leftSql);
                sql.Add($" {op} ");
                sql.Add(rightSql);
            }
        }
    }

    /// <summary>
    /// Extracts the SQL alias from the first column value in a JoinByTableDef.
    /// Column values are fully-qualified like "\"a_2\".\"account_id\"" — the alias is the part before the dot.
    /// Falls back to quoting the joinMap key if no columns are present.
    /// </summary>
    private static string ExtractAliasFromColumns(Dictionary<string, string> columns, string fallbackAlias)
    {
        if (columns.Count == 0)
            return $"\"{fallbackAlias}\"";

        var firstColValue = columns.Values.First();
        // Column values look like: "a_2"."account_id" — extract the first quoted segment
        var dotIndex = firstColValue.IndexOf('.');
        if (dotIndex > 0)
            return firstColValue[..dotIndex];

        return $"\"{fallbackAlias}\"";
    }

    /// <summary>
    /// Resolves a "prefix.colKey" column reference to its SQL expression using the joinMap.
    /// Prefix is "_" for the root/source table, or a table alias for joined tables.
    /// </summary>
    private static string ResolveJoinColRef(string colRef, Dictionary<string, JoinByTableDef> joinMap)
    {
        var dotIndex = colRef.IndexOf('.');
        if (dotIndex == -1)
            throw new InvalidOperationException(
                $"Invalid column reference: '{colRef}'. Must be 'alias.column' (e.g., '_.id' or 'account.accountId')");

        var prefix = colRef[..dotIndex];
        var colKey = colRef[(dotIndex + 1)..];

        if (!joinMap.TryGetValue(prefix, out var tableDef))
            throw new InvalidOperationException(
                $"Invalid column reference prefix: '{prefix}'. Not found in joinMap");

        if (!tableDef.Columns.TryGetValue(colKey, out var colSql))
            throw new InvalidOperationException(
                $"Invalid column: '{colKey}' in table '{prefix}'. Allowed: {string.Join(", ", tableDef.Columns.Keys)}");

        return colSql;
    }

    private void BuildUpsert(UpsertNode node, Dictionary<string, object?> parameters, List<string> sql, List<object?> values)
    {
        if (!parameters.TryGetValue(node.Param, out var obj)) return;
        var rows = CoerceRowList(obj);
        if (rows == null || rows.Count == 0) throw new InvalidOperationException("insert/upsert requires a non-empty rows array");

        var keys = GetCanonicalKeys(node.Columns, rows[0]);
        var conflictSet = new HashSet<string>(node.ConflictKeys);

        if (_dialect == "transactsql")
            BuildUpsertMssql(node, keys, conflictSet, rows, sql, values);
        else
            BuildUpsertPgSqlite(node, keys, conflictSet, rows, sql, values);
    }

    private void BuildUpsertPgSqlite(UpsertNode node, List<string> keys, HashSet<string> conflictSet,
        List<Dictionary<string, object?>> rows, List<string> sql, List<object?> values)
    {
        // (col1, col2, ...) VALUES (...) ON CONFLICT (pk) DO UPDATE SET col = EXCLUDED.col
        sql.Add("(");
        for (int i = 0; i < keys.Count; i++)
        {
            if (i > 0) sql.Add(", ");
            sql.Add(node.Columns[keys[i]]);
        }
        sql.Add(") values ");

        for (int r = 0; r < rows.Count; r++)
        {
            if (r > 0) sql.Add(", ");
            sql.Add("(");
            for (int i = 0; i < keys.Count; i++)
            {
                if (i > 0) sql.Add(", ");
                sql.Add(FormatParam());
                values.Add(rows[r].GetValueOrDefault(keys[i]));
            }
            sql.Add(")");
        }

        sql.Add(" on conflict (");
        for (int i = 0; i < node.ConflictKeys.Count; i++)
        {
            if (i > 0) sql.Add(", ");
            sql.Add(node.Columns[node.ConflictKeys[i]]);
        }
        sql.Add(") do update set ");

        int emitted = 0;
        foreach (var key in keys.Where(key => !conflictSet.Contains(key)))
        {
            if (emitted > 0) sql.Add(", ");
            var col = node.Columns[key];
            sql.Add(col);
            sql.Add(" = excluded.");
            sql.Add(col);
            emitted++;
        }
    }

    private void BuildUpsertMssql(UpsertNode node, List<string> keys, HashSet<string> conflictSet,
        List<Dictionary<string, object?>> rows, List<string> sql, List<object?> values)
    {
        // USING (VALUES (...)) AS src(cols) ON (t.pk = src.pk) WHEN MATCHED ... WHEN NOT MATCHED ...
        sql.Add("using (values ");
        for (int r = 0; r < rows.Count; r++)
        {
            if (r > 0) sql.Add(", ");
            sql.Add("(");
            for (int i = 0; i < keys.Count; i++)
            {
                if (i > 0) sql.Add(", ");
                sql.Add(FormatParam());
                values.Add(rows[r].GetValueOrDefault(keys[i]));
            }
            sql.Add(")");
        }
        sql.Add(") as src(");
        for (int i = 0; i < keys.Count; i++)
        {
            if (i > 0) sql.Add(", ");
            sql.Add(node.Columns[keys[i]]);
        }
        sql.Add(") on (");

        // ON clause
        for (int i = 0; i < node.ConflictKeys.Count; i++)
        {
            if (i > 0) sql.Add(" and ");
            var col = node.Columns[node.ConflictKeys[i]];
            sql.Add(node.TableName);
            sql.Add(".");
            sql.Add(col);
            sql.Add(" = src.");
            sql.Add(col);
        }
        sql.Add(") when matched then update set ");

        // SET col = src.col (non-conflict)
        int emitted = 0;
        foreach (var key in keys.Where(key => !conflictSet.Contains(key)))
        {
            if (emitted > 0) sql.Add(", ");
            var col = node.Columns[key];
            sql.Add(col);
            sql.Add(" = src.");
            sql.Add(col);
            emitted++;
        }

        // WHEN NOT MATCHED
        sql.Add(" when not matched then insert (");
        for (int i = 0; i < keys.Count; i++)
        {
            if (i > 0) sql.Add(", ");
            sql.Add(node.Columns[keys[i]]);
        }
        sql.Add(") values (");
        for (int i = 0; i < keys.Count; i++)
        {
            if (i > 0) sql.Add(", ");
            sql.Add("src.");
            sql.Add(node.Columns[keys[i]]);
        }
        sql.Add(")");
    }

    private static readonly HashSet<string> ValidWindowFunctions = new()
    {
        "row_number", "rank", "dense_rank", "percent_rank", "cume_dist",
        "ntile",
        "sum", "avg", "count", "min", "max", "first_value", "last_value",
        "lag", "lead"
    };

    private static readonly HashSet<string> RankingFunctions = new()
    {
        "row_number", "rank", "dense_rank", "percent_rank", "cume_dist"
    };

    private static readonly HashSet<string> AggregateFunctions = new()
    {
        "sum", "avg", "count", "min", "max", "first_value", "last_value"
    };

    private static readonly HashSet<string> OffsetFunctions = new()
    {
        "lag", "lead"
    };

    private void BuildWindowBy(WindowByNode windowBy, Dictionary<string, object?> parameters, List<string> sql, List<object?> values)
    {
        if (!parameters.TryGetValue(windowBy.Param, out var obj)) return;
        if (obj is not Dictionary<string, object?> entries || entries.Count == 0) return;

        foreach (var (alias, defObj) in entries)
        {
            if (defObj is not Dictionary<string, object?> def) continue;

            if (!def.TryGetValue("fn", out var fnObj) || fnObj is not string fn || string.IsNullOrEmpty(fn))
                throw new InvalidOperationException("windowBy: each entry requires a 'fn' property");

            if (!ValidWindowFunctions.Contains(fn))
                throw new InvalidOperationException(
                    $"windowBy: invalid function '{fn}'. Valid: {string.Join(", ", ValidWindowFunctions)}");

            sql.Add(", ");

            // Emit function call
            WriteWindowFunctionCall(fn, def, windowBy.Columns, sql);

            // Emit OVER clause
            sql.Add(" over (");
            WriteOverClause(def, windowBy.Columns, sql);
            sql.Add(")");

            // Emit alias
            sql.Add($" as \"{alias}\"");
        }
    }

    private void WriteWindowFunctionCall(string fn, Dictionary<string, object?> def, Dictionary<string, string> columns, List<string> sql)
    {
        if (RankingFunctions.Contains(fn))
        {
            sql.Add($"{fn}()");
            return;
        }

        if (fn == "ntile")
        {
            if (!def.TryGetValue("args", out var argsObj))
                throw new InvalidOperationException("windowBy: ntile requires 'args' (positive integer bucket count)");
            var args = Convert.ToInt32(argsObj);
            if (args <= 0)
                throw new InvalidOperationException($"windowBy: ntile 'args' must be a positive integer, got {args}");
            sql.Add($"ntile({args})");
            return;
        }

        if (AggregateFunctions.Contains(fn))
        {
            if (!def.TryGetValue("col", out var colObj) || colObj is not string col || string.IsNullOrEmpty(col))
                throw new InvalidOperationException($"windowBy: aggregate function '{fn}' requires 'col'");

            sql.Add($"{fn}(");
            if (col == "*")
                sql.Add("*");
            else
                sql.Add(ResolveWindowColumn(col, columns));
            sql.Add(")");
            return;
        }

        if (OffsetFunctions.Contains(fn))
        {
            if (!def.TryGetValue("col", out var colObj) || colObj is not string col || string.IsNullOrEmpty(col))
                throw new InvalidOperationException($"windowBy: offset function '{fn}' requires 'col'");

            var offset = 1;
            if (def.TryGetValue("args", out var argsObj) && argsObj != null)
                offset = Convert.ToInt32(argsObj);

            sql.Add($"{fn}(");
            sql.Add(ResolveWindowColumn(col, columns));
            sql.Add($", {offset})");
        }
    }

    private void WriteOverClause(Dictionary<string, object?> def, Dictionary<string, string> columns, List<string> sql)
    {
        if (!def.TryGetValue("over", out var overObj) || overObj is not Dictionary<string, object?> over)
            return;

        bool hasContent = false;

        // PARTITION BY
        if (over.TryGetValue("partitionBy", out var partObj) && partObj is object?[] partCols && partCols.Length > 0)
        {
            sql.Add("partition by ");
            for (int i = 0; i < partCols.Length; i++)
            {
                if (i > 0) sql.Add(", ");
                sql.Add(ResolveWindowColumn(partCols[i]?.ToString() ?? "", columns));
            }
            hasContent = true;
        }

        // ORDER BY
        if (over.TryGetValue("orderBy", out var ordObj) && ordObj is Dictionary<string, object?> ordEntries && ordEntries.Count > 0)
        {
            if (hasContent) sql.Add(" ");
            sql.Add("order by ");
            int emitted = 0;
            foreach (var (col, dirObj) in ordEntries)
            {
                if (emitted > 0) sql.Add(", ");
                sql.Add(ResolveWindowColumn(col, columns));
                var dir = dirObj?.ToString()?.ToUpper() ?? "ASC";
                if (dir != "ASC" && dir != "DESC")
                    throw new InvalidOperationException($"windowBy: invalid orderBy direction '{dirObj}'. Must be ASC or DESC.");
                sql.Add($" {dir}");
                emitted++;
            }
            hasContent = true;
        }

        // FRAME clause
        var hasStart = over.TryGetValue("start", out var startObj) && startObj != null;
        var hasEnd = over.TryGetValue("end", out var endObj) && endObj != null;

        if (hasStart || hasEnd)
        {
            if (!over.TryGetValue("frame", out var frameObj) || frameObj is not string frame || (frame != "rows" && frame != "range"))
                throw new InvalidOperationException("windowBy: 'frame' (rows|range) is required when start/end are specified");

            // MSSQL validation: RANGE with numeric bounds is not supported
            if (frame == "range" && _dialect == "transactsql")
            {
                var startIsNumeric = startObj is int or long or double or float || (startObj is string s && int.TryParse(s, out _));
                var endIsNumeric = endObj is int or long or double or float || (endObj is string s2 && int.TryParse(s2, out _));
                if (startIsNumeric || endIsNumeric)
                    throw new InvalidOperationException(
                        "windowBy: MSSQL does not support numeric bounds with RANGE frame. Use frame: \"rows\" instead.");
            }

            if (hasContent) sql.Add(" ");
            sql.Add($"{frame} between ");
            sql.Add(FormatFrameBound(startObj ?? "unbounded preceding", "start"));
            sql.Add(" and ");
            sql.Add(FormatFrameBound(endObj ?? "unbounded following", "end"));
        }
    }

    private static string ResolveWindowColumn(string col, Dictionary<string, string> columns)
    {
        if (columns.TryGetValue(col, out var colSql))
        {
            // Strip " as \"alias\"" suffix if present — we need the raw column reference
            var asIdx = colSql.IndexOf(" as \"", StringComparison.OrdinalIgnoreCase);
            return asIdx > 0 ? colSql[..asIdx] : colSql;
        }
        // Fallback: emit quoted identifier
        return $"\"{col}\"";
    }

    private static string FormatFrameBound(object? bound, string position)
    {
        if (bound is string str)
        {
            // Known string bounds
            if (str == "unbounded preceding" || str == "unbounded following" || str == "current row")
                return str;
            // Try parsing as number
            if (int.TryParse(str, out var parsed))
                return FormatNumericBound(parsed, position);
            return str;
        }

        if (bound is int or long or double or float)
        {
            var num = Convert.ToInt32(bound);
            return FormatNumericBound(num, position);
        }

        return "current row";
    }

    private static string FormatNumericBound(int num, string position)
    {
        if (num == 0) return "current row";
        return position == "start" ? $"{num} preceding" : $"{num} following";
    }

    private string FormatParam()
    {
        var index = _paramIndex;
        _paramIndex++;
        return _dialect switch
        {
            "postgresql" or "duckdb" => $"${index + 1}",
            "transactsql" => $"@param_{index}",
            "sqlite" => "?",
            _ => "?",
        };
    }

    private static List<Dictionary<string, object?>>? CoerceRowList(object? obj)
    {
        if (obj is List<Dictionary<string, object?>> list) return list;
        if (obj is object?[] array)
        {
            var result = array.OfType<Dictionary<string, object?>>().ToList();
            return result.Count > 0 ? result : null;
        }
        return null;
    }

    private static List<string> GetCanonicalKeys(Dictionary<string, string> columns, Dictionary<string, object?> firstRow)
    {
        // Return keys in column map order, filtered to those present in the first row
        return columns.Keys.Where(k => firstRow.ContainsKey(k)).ToList();
    }

    private void BuildPagination(Dictionary<string, object?> parameters, List<string> sql, List<object?> values)
    {
        var hasLimit = parameters.TryGetValue("limit", out var limitVal) && limitVal != null;
        var hasOffset = parameters.TryGetValue("offset", out var offsetVal) && offsetVal != null;

        if (hasLimit)
        {
            sql.Add("limit ");
            sql.Add(FormatParam());
            values.Add(limitVal);
        }

        if (hasOffset)
        {
            if (hasLimit) sql.Add(" ");
            sql.Add("offset ");
            sql.Add(FormatParam());
            values.Add(offsetVal);
        }
    }
}

public sealed record SqlBuildResult(string Text, List<object?> Values);
