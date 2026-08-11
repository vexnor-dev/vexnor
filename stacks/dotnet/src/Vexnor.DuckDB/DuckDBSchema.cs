using System.Collections;
using System.Globalization;
using System.Text.Json.Serialization;
using Vexnor.Core.Execution;

namespace Vexnor.DuckDB;

public sealed partial class DuckDBExecutor
{
    /// <summary>
    /// Introspects DuckDB tables, views, columns, keys, relationships, and enum types.
    /// </summary>
    public async Task<DuckDBSchema> GetSchemaAsync(
        IReadOnlyList<string> schemas,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(schemas);
        if (schemas.Count == 0)
            throw new ArgumentException("At least one DuckDB schema is required.", nameof(schemas));

        var placeholders = string.Join(", ", Enumerable.Range(1, schemas.Count).Select(index => $"${index}"));
        var values = schemas.Cast<object?>().ToList();
        var tableRows = await QueryAsync(new SqlBuildResult(
            $"SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema IN ({placeholders}) ORDER BY table_schema, table_name",
            values), cancellationToken);

        var tables = tableRows.Select(row => new DuckDBTable
        {
            TableSchema = RequiredString(row, "table_schema"),
            TableName = RequiredString(row, "table_name"),
            TableType = RequiredString(row, "table_type") == "VIEW" ? "view" : "table"
        }).ToList();
        var tableIndex = tables.ToDictionary(table => (table.TableSchema, table.TableName));

        var columnRows = await QueryAsync(new SqlBuildResult(
            $"SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default, ordinal_position, numeric_precision_radix FROM information_schema.columns WHERE table_schema IN ({placeholders}) ORDER BY table_schema, table_name, ordinal_position",
            values), cancellationToken);
        foreach (var row in columnRows)
        {
            var key = (RequiredString(row, "table_schema"), RequiredString(row, "table_name"));
            if (tableIndex.TryGetValue(key, out var table))
            {
                table.Columns.Add(new DuckDBColumn
                {
                    TableSchema = key.Item1,
                    TableName = key.Item2,
                    ColumnName = RequiredString(row, "column_name"),
                    DataType = RequiredString(row, "data_type"),
                    IsNullable = RequiredString(row, "is_nullable"),
                    IsUpdatable = table.TableType == "table" ? "YES" : "NO",
                    ColumnDefault = OptionalString(row, "column_default"),
                    OrdinalPosition = RequiredInt64(row, "ordinal_position"),
                    NumericPrecisionRadix = OptionalInt64(row, "numeric_precision_radix")
                });
            }
        }

        var primaryKeyRows = await QueryAsync(new SqlBuildResult(
            $"SELECT kcu.constraint_name, kcu.table_schema, kcu.table_name, kcu.column_name, kcu.ordinal_position FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_schema = kcu.constraint_schema AND tc.constraint_name = kcu.constraint_name WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema IN ({placeholders}) ORDER BY kcu.table_schema, kcu.table_name, kcu.ordinal_position",
            values), cancellationToken);
        foreach (var row in primaryKeyRows)
        {
            var key = (RequiredString(row, "table_schema"), RequiredString(row, "table_name"));
            if (tableIndex.TryGetValue(key, out var table))
            {
                table.PrimaryKeys.Add(new DuckDBPrimaryKey
                {
                    ConstraintName = RequiredString(row, "constraint_name"),
                    TableSchema = key.Item1,
                    TableName = key.Item2,
                    ColumnName = RequiredString(row, "column_name"),
                    OrdinalPosition = RequiredInt64(row, "ordinal_position")
                });
            }
        }

        var foreignKeyRows = await QueryAsync(new SqlBuildResult(
            $"SELECT source.constraint_name, source.table_schema, source.table_name, source.column_name, target.table_schema AS referenced_table_schema, target.table_name AS referenced_table_name, target.column_name AS referenced_column_name FROM information_schema.referential_constraints rc JOIN information_schema.key_column_usage source ON rc.constraint_schema = source.constraint_schema AND rc.constraint_name = source.constraint_name JOIN information_schema.key_column_usage target ON rc.unique_constraint_schema = target.constraint_schema AND rc.unique_constraint_name = target.constraint_name AND source.position_in_unique_constraint = target.ordinal_position WHERE source.table_schema IN ({placeholders}) ORDER BY source.table_schema, source.table_name, source.ordinal_position",
            values), cancellationToken);
        foreach (var row in foreignKeyRows)
        {
            var key = (RequiredString(row, "table_schema"), RequiredString(row, "table_name"));
            if (tableIndex.TryGetValue(key, out var table))
            {
                table.ForeignKeys.Add(new DuckDBForeignKey
                {
                    ConstraintName = RequiredString(row, "constraint_name"),
                    TableSchema = key.Item1,
                    TableName = key.Item2,
                    ColumnName = RequiredString(row, "column_name"),
                    ReferencedTableSchema = RequiredString(row, "referenced_table_schema"),
                    ReferencedTableName = RequiredString(row, "referenced_table_name"),
                    ReferencedColumnName = RequiredString(row, "referenced_column_name")
                });
            }
        }

        var enumRows = await QueryAsync(new SqlBuildResult(
            $"SELECT schema_name AS enum_schema, type_name AS enum_name, labels AS enum_values FROM duckdb_types() WHERE logical_type = 'ENUM' AND labels IS NOT NULL AND schema_name IN ({placeholders}) ORDER BY schema_name, type_name",
            values), cancellationToken);
        var enums = enumRows.Select(row => new DuckDBEnum
        {
            EnumSchema = RequiredString(row, "enum_schema"),
            EnumName = RequiredString(row, "enum_name"),
            EnumValues = ReadEnumValues(row.GetValueOrDefault("enum_values"))
        }).ToList();

        return new DuckDBSchema { Tables = tables, Enums = enums };
    }

    private static List<DuckDBEnumValue> ReadEnumValues(object? value)
    {
        if (value is not IEnumerable values || value is string)
            throw new InvalidDataException($"DuckDB enum labels have unsupported type {value?.GetType().FullName ?? "null"}.");

        var result = new List<DuckDBEnumValue>();
        foreach (var label in values)
            result.Add(new DuckDBEnumValue { EnumLabel = Convert.ToString(label, CultureInfo.InvariantCulture) ?? string.Empty });
        return result;
    }

    private static string RequiredString(IReadOnlyDictionary<string, object?> row, string name) =>
        row[name] is string value
            ? value
            : throw new InvalidDataException($"DuckDB schema field '{name}' must be a string.");

    private static string? OptionalString(IReadOnlyDictionary<string, object?> row, string name)
    {
        var value = row[name];
        return value switch
        {
            null => null,
            string text => text,
            _ => throw new InvalidDataException($"DuckDB schema field '{name}' must be a string or null.")
        };
    }

    private static long RequiredInt64(IReadOnlyDictionary<string, object?> row, string name) =>
        Convert.ToInt64(row[name], CultureInfo.InvariantCulture);

    private static long? OptionalInt64(IReadOnlyDictionary<string, object?> row, string name) =>
        row[name] is null ? null : Convert.ToInt64(row[name], CultureInfo.InvariantCulture);
}

public sealed class DuckDBSchema
{
    [JsonPropertyName("tables")]
    public required List<DuckDBTable> Tables { get; init; }

    [JsonPropertyName("enums")]
    public required List<DuckDBEnum> Enums { get; init; }
}

public sealed class DuckDBTable
{
    [JsonPropertyName("table_schema")]
    public required string TableSchema { get; init; }

    [JsonPropertyName("table_name")]
    public required string TableName { get; init; }

    [JsonPropertyName("table_type")]
    public required string TableType { get; init; }

    [JsonPropertyName("columns")]
    public List<DuckDBColumn> Columns { get; } = [];

    [JsonPropertyName("primary_keys")]
    public List<DuckDBPrimaryKey> PrimaryKeys { get; } = [];

    [JsonPropertyName("foreign_keys")]
    public List<DuckDBForeignKey> ForeignKeys { get; } = [];
}

public sealed class DuckDBColumn
{
    [JsonPropertyName("table_schema")]
    public required string TableSchema { get; init; }

    [JsonPropertyName("table_name")]
    public required string TableName { get; init; }

    [JsonPropertyName("column_name")]
    public required string ColumnName { get; init; }

    [JsonPropertyName("data_type")]
    public required string DataType { get; init; }

    [JsonPropertyName("is_nullable")]
    public required string IsNullable { get; init; }

    [JsonPropertyName("is_updatable")]
    public required string IsUpdatable { get; init; }

    [JsonPropertyName("column_default")]
    public string? ColumnDefault { get; init; }

    [JsonPropertyName("ordinal_position")]
    public long OrdinalPosition { get; init; }

    [JsonPropertyName("numeric_precision_radix")]
    public long? NumericPrecisionRadix { get; init; }
}

public sealed class DuckDBPrimaryKey
{
    [JsonPropertyName("constraint_name")]
    public required string ConstraintName { get; init; }

    [JsonPropertyName("table_schema")]
    public required string TableSchema { get; init; }

    [JsonPropertyName("table_name")]
    public required string TableName { get; init; }

    [JsonPropertyName("column_name")]
    public required string ColumnName { get; init; }

    [JsonPropertyName("ordinal_position")]
    public long OrdinalPosition { get; init; }
}

public sealed class DuckDBForeignKey
{
    [JsonPropertyName("constraint_name")]
    public required string ConstraintName { get; init; }

    [JsonPropertyName("table_schema")]
    public required string TableSchema { get; init; }

    [JsonPropertyName("table_name")]
    public required string TableName { get; init; }

    [JsonPropertyName("column_name")]
    public required string ColumnName { get; init; }

    [JsonPropertyName("referenced_table_schema")]
    public required string ReferencedTableSchema { get; init; }

    [JsonPropertyName("referenced_table_name")]
    public required string ReferencedTableName { get; init; }

    [JsonPropertyName("referenced_column_name")]
    public required string ReferencedColumnName { get; init; }
}

public sealed class DuckDBEnum
{
    [JsonPropertyName("enum_schema")]
    public required string EnumSchema { get; init; }

    [JsonPropertyName("enum_name")]
    public required string EnumName { get; init; }

    [JsonPropertyName("enum_values")]
    public required List<DuckDBEnumValue> EnumValues { get; init; }
}

public sealed class DuckDBEnumValue
{
    [JsonPropertyName("enum_label")]
    public required string EnumLabel { get; init; }
}
