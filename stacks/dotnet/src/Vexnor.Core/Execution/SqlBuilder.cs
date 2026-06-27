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

    public SqlBuilder(string dialect)
    {
        _dialect = dialect;
    }

    public SqlBuildResult Build(QueryDefinition query, Dictionary<string, object?> parameters)
    {
        _paramIndex = 0;
        var sql = new List<string>();
        var values = new List<object?>();

        BuildNodes(query.Template, parameters, sql, values);

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
                    BuildProjection(projection, parameters, sql, values);
                    break;

                case PaginationNode:
                    BuildPagination(parameters, sql, values);
                    break;

                case UpsertNode upsert:
                    BuildUpsert(upsert, parameters, sql, values);
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
                if (args.Length == 0) { sql.Add(colSql); sql.Add(" is null"); break; }
                sql.Add(colSql); sql.Add(" between "); sql.Add(FormatParam()); values.Add(args[0]);
                sql.Add(" and "); sql.Add(FormatParam()); values.Add(args[1]);
                break;
            case "in":
            {
                var list = args.Length > 0 && args[0] is object?[] arr ? arr : args;
                if (list.Length == 0) { sql.Add(colSql); sql.Add(" is null"); break; }
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
                if (list.Length == 0) { sql.Add(colSql); sql.Add(" is not null"); break; }
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

    private void BuildProjection(ProjectionNode projection, Dictionary<string, object?> parameters, List<string> sql, List<object?> values)
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

    private string FormatParam()
    {
        var index = _paramIndex;
        _paramIndex++;
        return _dialect switch
        {
            "postgresql" => $"${index + 1}",
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
