package vexnor

import (
	"fmt"
	"sort"
	"strings"
)

// SqlBuildResult holds the generated SQL text and parameter values.
type SqlBuildResult struct {
	Text   string
	Values []any
}

// AggregateColumnTransform is a function that transforms the column SQL inside
// an aggregate function call. Called with (functionName, columnSql, columnType)
// and returns the (possibly transformed) column SQL.
// Used by SqlSelectCommand subclasses to inject dialect-specific behavior
// (e.g., PostgreSQL boolean → ::int cast inside SUM/AVG).
type AggregateColumnTransform func(fn, colSql string, colType *string) string

// SqlBuilder evaluates a query template with runtime parameters and produces
// SQL text + parameter values. It is a direct port of the .NET SqlBuilder.
type SqlBuilder struct {
	dialect            string
	paramIndex         int
	aggregateTransform AggregateColumnTransform
	rowSchema          map[string]*ColumnSchema
}

// NewSqlBuilder creates a new SqlBuilder for the given SQL dialect.
// Supported dialects: "postgresql", "transactsql", "sqlite".
func NewSqlBuilder(dialect string) *SqlBuilder {
	return &SqlBuilder{dialect: dialect}
}

// Build evaluates the query template against the provided parameters and
// returns the resulting SQL text and parameter values.
func (b *SqlBuilder) Build(query *QueryDefinition, params map[string]any) (*SqlBuildResult, error) {
	return b.BuildWithTransform(query, params, nil)
}

// BuildWithTransform evaluates the query template against the provided parameters,
// applying an optional AggregateColumnTransform during projection node processing.
// This mirrors the .NET SqlBuilder.Build(query, params, aggregateColumnTransform) overload.
func (b *SqlBuilder) BuildWithTransform(query *QueryDefinition, params map[string]any, transform AggregateColumnTransform) (*SqlBuildResult, error) {
	b.paramIndex = 0
	b.aggregateTransform = transform
	b.rowSchema = query.Row
	var sql []string
	var values []any

	if err := b.buildNodes(query.Template, params, &sql, &values); err != nil {
		b.aggregateTransform = nil
		b.rowSchema = nil
		return nil, err
	}

	b.aggregateTransform = nil
	b.rowSchema = nil
	return &SqlBuildResult{
		Text:   strings.Join(sql, ""),
		Values: values,
	}, nil
}

func (b *SqlBuilder) buildNodes(nodes TemplateNodes, params map[string]any, sql *[]string, values *[]any) error {
	for _, node := range nodes {
		switch n := node.(type) {
		case *TextNode:
			*sql = append(*sql, n.Value)
		case *ParamNode:
			b.buildParam(n, params, sql, values)
		case *ValueNode:
			*sql = append(*sql, b.formatParam())
			*values = append(*values, n.Value)
		case *WhenNode:
			if err := b.buildWhen(n, params, sql, values); err != nil {
				return err
			}
		case *SetNode:
			if err := b.buildSet(n, params, sql, values); err != nil {
				return err
			}
		case *InsertNode:
			if err := b.buildInsert(n, params, sql, values); err != nil {
				return err
			}
		case *InsertColsNode:
			if err := b.buildInsertCols(n, params, sql); err != nil {
				return err
			}
		case *InsertValuesNode:
			if err := b.buildInsertValues(n, params, sql, values); err != nil {
				return err
			}
		case *FilterNode:
			if err := b.buildFilter(n, params, sql, values); err != nil {
				return err
			}
		case *OrderByNode:
			if err := b.buildOrderBy(n, params, sql); err != nil {
				return err
			}
		case *ProjectionNode:
			if err := b.buildProjection(n, params, sql, values); err != nil {
				return err
			}
		case *PaginationNode:
			b.buildPagination(params, sql, values)
		case *JoinByNode:
			if err := b.buildJoinBy(n, params, sql, values); err != nil {
				return err
			}
		case *UpsertNode:
			if err := b.buildUpsert(n, params, sql, values); err != nil {
				return err
			}
		case *WindowByNode:
			if err := b.buildWindowBy(n, params, sql); err != nil {
				return err
			}
		}
	}
	return nil
}

// formatParam returns the next dialect-specific placeholder and increments the index.
func (b *SqlBuilder) formatParam() string {
	index := b.paramIndex
	b.paramIndex++
	switch b.dialect {
	case "postgresql":
		return fmt.Sprintf("$%d", index+1)
	case "transactsql":
		return fmt.Sprintf("@param_%d", index)
	default: // sqlite and others
		return "?"
	}
}

// coerceRowList coerces a parameter value into a slice of maps.
// Accepts []map[string]any directly or []any containing map[string]any elements.
func coerceRowList(obj any) ([]map[string]any, error) {
	switch v := obj.(type) {
	case []map[string]any:
		if len(v) == 0 {
			return nil, nil
		}
		return v, nil
	case []any:
		var result []map[string]any
		for _, item := range v {
			switch m := item.(type) {
			case map[string]any:
				result = append(result, m)
			case *OrderedDict:
				result = append(result, m.ToMap())
			}
		}
		if len(result) == 0 {
			return nil, nil
		}
		return result, nil
	default:
		return nil, nil
	}
}

// getCanonicalKeys returns column keys from the OrderedMap in their declared order,
// filtered to only those present in the first row.
func getCanonicalKeys(columns *OrderedMap, firstRow map[string]any) []string {
	var keys []string
	for _, k := range columns.Keys {
		if _, exists := firstRow[k]; exists {
			keys = append(keys, k)
		}
	}
	return keys
}

// extractAliasFromColumns extracts the SQL alias from the first column value.
// Column values look like: "a_2"."account_id" — the alias is the part before the dot.
func extractAliasFromColumns(columns *OrderedMap, fallback string) string {
	if columns.Len() == 0 {
		return fmt.Sprintf("\"%s\"", fallback)
	}
	firstColValue := columns.Values[columns.Keys[0]]
	dotIndex := strings.Index(firstColValue, ".")
	if dotIndex > 0 {
		return firstColValue[:dotIndex]
	}
	return fmt.Sprintf("\"%s\"", fallback)
}

// resolveJoinColRef resolves a "prefix.colKey" column reference to its SQL expression.
func resolveJoinColRef(ref string, joinMap map[string]*JoinByTableDef) (string, error) {
	dotIndex := strings.Index(ref, ".")
	if dotIndex == -1 {
		return "", fmt.Errorf("invalid column reference: '%s'. Must be 'alias.column' (e.g., '_.id' or 'account.accountId')", ref)
	}
	prefix := ref[:dotIndex]
	colKey := ref[dotIndex+1:]

	tableDef, ok := joinMap[prefix]
	if !ok {
		return "", fmt.Errorf("invalid column reference prefix: '%s'. Not found in joinMap", prefix)
	}
	colSQL, ok := tableDef.Columns.Get(colKey)
	if !ok {
		return "", fmt.Errorf("invalid column: '%s' in table '%s'. Allowed: %s", colKey, prefix, strings.Join(tableDef.Columns.Keys, ", "))
	}
	return colSQL, nil
}

// buildParam handles ParamNode — emits placeholder(s) for a named parameter.
func (b *SqlBuilder) buildParam(node *ParamNode, params map[string]any, sql *[]string, values *[]any) {
	value := params[node.Name]

	if node.Array {
		if arr, ok := value.([]any); ok {
			for i, item := range arr {
				if i > 0 {
					*sql = append(*sql, ", ")
				}
				*sql = append(*sql, b.formatParam())
				*values = append(*values, item)
			}
			return
		}
	}

	*sql = append(*sql, b.formatParam())
	*values = append(*values, value)
}

// buildWhen handles WhenNode — conditional template branching.
func (b *SqlBuilder) buildWhen(node *WhenNode, params map[string]any, sql *[]string, values *[]any) error {
	val, exists := params[node.Param]
	isPresent := exists && val != nil && val != false

	flag := isPresent
	if node.Negate {
		flag = !isPresent
	}

	if flag {
		return b.buildNodes(node.OnTrue, params, sql, values)
	} else if len(node.OnFalse) > 0 {
		return b.buildNodes(node.OnFalse, params, sql, values)
	}
	return nil
}

// buildSet handles SetNode — emits SET clause for UPDATE statements.
func (b *SqlBuilder) buildSet(node *SetNode, params map[string]any, sql *[]string, values *[]any) error {
	obj, exists := params[node.Param]
	if !exists || obj == nil {
		return fmt.Errorf("set() requires a non-empty object")
	}

	// Extract ordered keys and lookup function from the param value.
	var orderedKeys []string
	var getValue func(string) (any, bool)

	switch v := obj.(type) {
	case *OrderedDict:
		if v.Len() == 0 {
			return fmt.Errorf("set() requires at least one column")
		}
		orderedKeys = v.OrderedKeys()
		getValue = func(key string) (any, bool) { return v.Get(key) }
	case map[string]any:
		if len(v) == 0 {
			return fmt.Errorf("set() requires at least one column")
		}
		// For plain maps, use node.Columns.Keys order
		orderedKeys = node.Columns.Keys
		getValue = func(key string) (any, bool) { val, ok := v[key]; return val, ok }
	default:
		return fmt.Errorf("set() requires a non-empty object")
	}

	*sql = append(*sql, "set ")
	emitted := 0
	for _, key := range orderedKeys {
		value, present := getValue(key)
		if !present {
			continue
		}
		colSQL, ok := node.Columns.Get(key)
		if !ok {
			continue
		}
		if emitted > 0 {
			*sql = append(*sql, ", ")
		}
		*sql = append(*sql, colSQL)
		*sql = append(*sql, " = ")
		*sql = append(*sql, b.formatParam())
		*values = append(*values, value)
		emitted++
	}
	return nil
}

// buildInsert handles InsertNode — emits full INSERT (cols + values).
func (b *SqlBuilder) buildInsert(node *InsertNode, params map[string]any, sql *[]string, values *[]any) error {
	obj, exists := params[node.Param]
	if !exists {
		return nil
	}
	rows, err := coerceRowList(obj)
	if err != nil {
		return err
	}
	if len(rows) == 0 {
		return fmt.Errorf("insert/upsert requires a non-empty rows array")
	}

	keys := getCanonicalKeys(node.Columns, rows[0])

	// Columns
	*sql = append(*sql, "(")
	for i, k := range keys {
		if i > 0 {
			*sql = append(*sql, ", ")
		}
		colSQL, _ := node.Columns.Get(k)
		*sql = append(*sql, colSQL)
	}
	*sql = append(*sql, ") values ")

	// Value tuples
	for r, row := range rows {
		if r > 0 {
			*sql = append(*sql, ", ")
		}
		*sql = append(*sql, "(")
		for i, k := range keys {
			if i > 0 {
				*sql = append(*sql, ", ")
			}
			*sql = append(*sql, b.formatParam())
			*values = append(*values, row[k])
		}
		*sql = append(*sql, ")")
	}
	return nil
}

// buildInsertCols handles InsertColsNode — emits only column names.
func (b *SqlBuilder) buildInsertCols(node *InsertColsNode, params map[string]any, sql *[]string) error {
	obj, exists := params[node.Param]
	if !exists {
		return nil
	}
	rows, err := coerceRowList(obj)
	if err != nil {
		return err
	}
	if len(rows) == 0 {
		return fmt.Errorf("insert/upsert requires a non-empty rows array")
	}

	keys := getCanonicalKeys(node.Columns, rows[0])
	for i, k := range keys {
		if i > 0 {
			*sql = append(*sql, ", ")
		}
		colSQL, _ := node.Columns.Get(k)
		*sql = append(*sql, colSQL)
	}
	return nil
}

// buildInsertValues handles InsertValuesNode — emits value tuples.
func (b *SqlBuilder) buildInsertValues(node *InsertValuesNode, params map[string]any, sql *[]string, values *[]any) error {
	obj, exists := params[node.Param]
	if !exists {
		return nil
	}
	rows, err := coerceRowList(obj)
	if err != nil {
		return err
	}
	if len(rows) == 0 {
		return fmt.Errorf("insert/upsert requires a non-empty rows array")
	}

	// Filter Keys to those present in first row
	var keys []string
	for _, k := range node.Keys {
		if _, exists := rows[0][k]; exists {
			keys = append(keys, k)
		}
	}

	for r, row := range rows {
		if r > 0 {
			*sql = append(*sql, ", ")
		}
		*sql = append(*sql, "(")
		for i, k := range keys {
			if i > 0 {
				*sql = append(*sql, ", ")
			}
			*sql = append(*sql, b.formatParam())
			*values = append(*values, row[k])
		}
		*sql = append(*sql, ")")
	}
	return nil
}

// validFilterOps lists the allowed filter operators.
var validFilterOps = map[string]bool{
	"=": true, "not": true, ">": true, ">=": true, "<": true, "<=": true, "!=": true,
	"between": true, "in": true, "notIn": true, "like": true, "notLike": true,
	"isNull": true, "isNotNull": true,
}

// buildFilter handles FilterNode — emits dynamic WHERE conditions.
func (b *SqlBuilder) buildFilter(node *FilterNode, params map[string]any, sql *[]string, values *[]any) error {
	obj, exists := params[node.Param]
	if !exists || obj == nil {
		return nil
	}

	var conditions []map[string]any

	switch v := obj.(type) {
	case *OrderedDict:
		// Legacy object form with preserved key order
		for _, key := range v.OrderedKeys() {
			val, _ := v.Get(key)
			if val != nil {
				conditions = append(conditions, map[string]any{key: val})
			}
		}
	case map[string]any:
		// Legacy object form: { col: value } → convert to array of single-key dicts
		for _, key := range node.Columns.Keys {
			if val, ok := v[key]; ok && val != nil {
				conditions = append(conditions, map[string]any{key: val})
			}
		}
	case []any:
		for _, item := range v {
			switch m := item.(type) {
			case map[string]any:
				conditions = append(conditions, m)
			case *OrderedDict:
				conditions = append(conditions, m.ToMap())
			}
		}
	default:
		return nil
	}

	if len(conditions) == 0 {
		return nil
	}

	if node.Prefix != nil {
		*sql = append(*sql, *node.Prefix)
	}
	if err := b.writeConditions(node, conditions, "and", sql, values); err != nil {
		return err
	}
	if node.Suffix != nil {
		*sql = append(*sql, *node.Suffix)
	}
	return nil
}

// writeConditions writes a list of conditions joined by the given joiner ("and" or "or").
func (b *SqlBuilder) writeConditions(node *FilterNode, conditions []map[string]any, joiner string, sql *[]string, values *[]any) error {
	emitted := 0
	for _, condition := range conditions {
		// Check for "or" group
		if orVal, hasOr := condition["or"]; hasOr {
			if orArr, ok := orVal.([]any); ok {
				var orConditions []map[string]any
				for _, item := range orArr {
					switch m := item.(type) {
					case map[string]any:
						orConditions = append(orConditions, m)
					case *OrderedDict:
						orConditions = append(orConditions, m.ToMap())
					}
				}
				if len(orConditions) == 0 {
					continue
				}
				if emitted > 0 {
					*sql = append(*sql, fmt.Sprintf(" %s ", joiner))
				}
				*sql = append(*sql, "(")
				if err := b.writeConditions(node, orConditions, "or", sql, values); err != nil {
					return err
				}
				*sql = append(*sql, ")")
				emitted++
			}
		} else {
			for _, key := range node.Columns.Keys {
				value, present := condition[key]
				if !present || value == nil {
					continue
				}
				colSQL, _ := node.Columns.Get(key)
				if emitted > 0 {
					*sql = append(*sql, fmt.Sprintf(" %s ", joiner))
				}
				if err := b.writeEntry(colSQL, value, sql, values); err != nil {
					return err
				}
				emitted++
			}
		}
	}
	return nil
}

// writeEntry writes a single filter condition entry.
func (b *SqlBuilder) writeEntry(colSQL string, value any, sql *[]string, values *[]any) error {
	if tuple, ok := value.([]any); ok && len(tuple) >= 1 {
		if op, ok := tuple[0].(string); ok {
			if !validFilterOps[op] {
				return fmt.Errorf("Invalid filter operator: '%s'. Allowed: =, not, >, >=, <, <=, !=, between, in, notIn, like, notLike, isNull, isNotNull", op)
			}
			return b.writeOp(colSQL, op, tuple[1:], sql, values)
		}
	}

	// Bare value — equality
	*sql = append(*sql, colSQL)
	*sql = append(*sql, " = ")
	*sql = append(*sql, b.formatParam())
	*values = append(*values, value)
	return nil
}

// writeOp writes a filter operation with its arguments.
func (b *SqlBuilder) writeOp(colSQL string, op string, args []any, sql *[]string, values *[]any) error {
	switch op {
	case "=":
		*sql = append(*sql, colSQL, " = ", b.formatParam())
		*values = append(*values, args[0])
	case "not", "!=":
		*sql = append(*sql, colSQL, " <> ", b.formatParam())
		*values = append(*values, args[0])
	case ">":
		*sql = append(*sql, colSQL, " > ", b.formatParam())
		*values = append(*values, args[0])
	case ">=":
		*sql = append(*sql, colSQL, " >= ", b.formatParam())
		*values = append(*values, args[0])
	case "<":
		*sql = append(*sql, colSQL, " < ", b.formatParam())
		*values = append(*values, args[0])
	case "<=":
		*sql = append(*sql, colSQL, " <= ", b.formatParam())
		*values = append(*values, args[0])
	case "between":
		if len(args) < 2 {
			return fmt.Errorf("'between' operator requires 2 arguments, got %d", len(args))
		}
		*sql = append(*sql, colSQL, " between ", b.formatParam())
		*values = append(*values, args[0])
		*sql = append(*sql, " and ", b.formatParam())
		*values = append(*values, args[1])
	case "in":
		list := args
		if len(args) > 0 {
			if arr, ok := args[0].([]any); ok {
				list = arr
			}
		}
		if len(list) == 0 {
			*sql = append(*sql, "1=0")
			return nil
		}
		*sql = append(*sql, colSQL, " in (")
		for i, item := range list {
			if i > 0 {
				*sql = append(*sql, ", ")
			}
			*sql = append(*sql, b.formatParam())
			*values = append(*values, item)
		}
		*sql = append(*sql, ")")
	case "notIn":
		list := args
		if len(args) > 0 {
			if arr, ok := args[0].([]any); ok {
				list = arr
			}
		}
		if len(list) == 0 {
			return nil
		}
		*sql = append(*sql, colSQL, " not in (")
		for i, item := range list {
			if i > 0 {
				*sql = append(*sql, ", ")
			}
			*sql = append(*sql, b.formatParam())
			*values = append(*values, item)
		}
		*sql = append(*sql, ")")
	case "like":
		*sql = append(*sql, colSQL, " like ", b.formatParam())
		*values = append(*values, args[0])
	case "notLike":
		*sql = append(*sql, colSQL, " not like ", b.formatParam())
		*values = append(*values, args[0])
	case "isNull":
		*sql = append(*sql, colSQL, " is null")
	case "isNotNull":
		*sql = append(*sql, colSQL, " is not null")
	default:
		// Unknown — fall back to equality
		*sql = append(*sql, colSQL, " = ", b.formatParam())
		if len(args) > 0 {
			*values = append(*values, args[0])
		} else {
			*values = append(*values, nil)
		}
	}
	return nil
}

// buildOrderBy handles OrderByNode — emits ORDER BY clause.
func (b *SqlBuilder) buildOrderBy(node *OrderByNode, params map[string]any, sql *[]string) error {
	obj, exists := params[node.Param]
	if !exists || obj == nil {
		return nil
	}

	// Extract ordered keys and lookup function
	var orderedKeys []string
	var getDir func(string) (any, bool)

	switch v := obj.(type) {
	case *OrderedDict:
		if v.Len() == 0 {
			return nil
		}
		orderedKeys = v.OrderedKeys()
		getDir = func(key string) (any, bool) { return v.Get(key) }
	case map[string]any:
		if len(v) == 0 {
			return nil
		}
		// For plain maps, use node.Columns.Keys order
		orderedKeys = node.Columns.Keys
		getDir = func(key string) (any, bool) { val, ok := v[key]; return val, ok }
	default:
		return nil
	}

	*sql = append(*sql, "order by ")
	emitted := 0
	for _, field := range orderedKeys {
		dirObj, present := getDir(field)
		if !present {
			continue
		}
		colSQL, ok := node.Columns.Get(field)
		if !ok {
			return fmt.Errorf("Invalid orderBy field: '%s'. Allowed fields: %s", field, strings.Join(node.Columns.Keys, ", "))
		}

		dir := "ASC"
		if dirObj != nil {
			if s, ok := dirObj.(string); ok && s != "" {
				dir = strings.ToUpper(s)
			}
		}
		if dir != "ASC" && dir != "DESC" {
			return fmt.Errorf("Invalid orderBy direction: '%v'. Must be 'ASC' or 'DESC'.", dirObj)
		}

		if emitted > 0 {
			*sql = append(*sql, ", ")
		}
		*sql = append(*sql, colSQL, " ", dir)
		emitted++
	}
	return nil
}

// buildProjection handles ProjectionNode — emits column projection with optional GROUP BY.
func (b *SqlBuilder) buildProjection(node *ProjectionNode, params map[string]any, sql *[]string, values *[]any) error {
	obj, exists := params[node.Param]
	if !exists {
		emitAllColumns(node.Columns, sql)
		return nil
	}

	entries, ok := obj.([]any)
	if !ok || len(entries) == 0 {
		emitAllColumns(node.Columns, sql)
		return nil
	}

	var groupByCols []string
	hasAggregate := false

	for i, entry := range entries {
		if i > 0 {
			*sql = append(*sql, ", ")
		}

		switch e := entry.(type) {
		case string:
			// Simple column name
			colSQL, ok := node.Columns.Get(e)
			if !ok {
				return fmt.Errorf("Invalid projection column: '%s'. Allowed: %s", e, strings.Join(node.Columns.Keys, ", "))
			}
			*sql = append(*sql, colSQL)
			groupByCols = append(groupByCols, colSQL)
		case []any:
			// Aggregate: [fn, colRef, alias]
			if len(e) < 3 {
				continue
			}
			fn, _ := e[0].(string)
			alias, _ := e[2].(string)

			if fn != "count" && fn != "sum" && fn != "avg" && fn != "min" && fn != "max" {
				return fmt.Errorf("Invalid aggregate function: '%s'. Allowed: count, sum, avg, min, max", fn)
			}
			hasAggregate = true

			*sql = append(*sql, fn, "(")
			if colRef, ok := e[1].(string); ok {
				if colRef == "*" {
					*sql = append(*sql, "*")
				} else {
					aggColSQL, ok := node.Columns.Get(colRef)
					if !ok {
						return fmt.Errorf("Invalid projection column in aggregate: '%s'. Allowed: %s", colRef, strings.Join(node.Columns.Keys, ", "))
					}
					// Apply aggregate column transform if provided
					if b.aggregateTransform != nil {
						var colType *string
						if b.rowSchema != nil {
							if schema, ok := b.rowSchema[colRef]; ok {
								colType = &schema.Type
							}
						}
						aggColSQL = b.aggregateTransform(fn, aggColSQL, colType)
					}
					*sql = append(*sql, aggColSQL)
				}
			}
			*sql = append(*sql, fmt.Sprintf(") as \"%s\"", alias))
		}
	}

	// Auto GROUP BY when aggregates are present
	if hasAggregate && len(groupByCols) > 0 {
		*sql = append(*sql, " group by ")
		for i, col := range groupByCols {
			if i > 0 {
				*sql = append(*sql, ", ")
			}
			*sql = append(*sql, col)
		}
	}
	return nil
}

// emitAllColumns writes all columns from the OrderedMap in order.
func emitAllColumns(columns *OrderedMap, sql *[]string) {
	for i, key := range columns.Keys {
		if i > 0 {
			*sql = append(*sql, ", ")
		}
		*sql = append(*sql, columns.Values[key])
	}
}

// buildPagination handles PaginationNode — emits LIMIT/OFFSET.
func (b *SqlBuilder) buildPagination(params map[string]any, sql *[]string, values *[]any) {
	limitVal, hasLimit := params["limit"]
	if hasLimit && limitVal == nil {
		hasLimit = false
	}
	offsetVal, hasOffset := params["offset"]
	if hasOffset && offsetVal == nil {
		hasOffset = false
	}

	if hasLimit {
		*sql = append(*sql, "limit ", b.formatParam())
		*values = append(*values, limitVal)
	}

	if hasOffset {
		if hasLimit {
			*sql = append(*sql, " ")
		}
		*sql = append(*sql, "offset ", b.formatParam())
		*values = append(*values, offsetVal)
	}
}

// Valid join types and ON operators.
var validJoinTypes = map[string]bool{
	"inner": true, "left": true, "right": true, "full": true, "cross": true,
}

var validJoinOps = map[string]bool{
	"=": true, "<": true, "<=": true, ">": true, ">=": true, "<>": true,
}

// buildJoinBy handles JoinByNode — emits dynamic JOIN clauses.
func (b *SqlBuilder) buildJoinBy(node *JoinByNode, params map[string]any, sql *[]string, values *[]any) error {
	obj, exists := params[node.Param]
	if !exists || obj == nil {
		return nil
	}

	// Extract ordered aliases and entry lookup from the param value
	var aliases []string
	var getEntry func(string) (map[string]any, bool)

	switch v := obj.(type) {
	case *OrderedDict:
		if v.Len() == 0 {
			return nil
		}
		aliases = v.OrderedKeys()
		getEntry = func(key string) (map[string]any, bool) {
			val, ok := v.Get(key)
			if !ok {
				return nil, false
			}
			switch e := val.(type) {
			case map[string]any:
				return e, true
			case *OrderedDict:
				return e.ToMap(), true
			}
			return nil, false
		}
	case map[string]any:
		if len(v) == 0 {
			return nil
		}
		for alias := range v {
			aliases = append(aliases, alias)
		}
		sort.Strings(aliases)
		getEntry = func(key string) (map[string]any, bool) {
			val, ok := v[key]
			if !ok {
				return nil, false
			}
			switch e := val.(type) {
			case map[string]any:
				return e, true
			case *OrderedDict:
				return e.ToMap(), true
			}
			return nil, false
		}
	default:
		return nil
	}

	for _, alias := range aliases {
		entry, ok := getEntry(alias)
		if !ok {
			continue
		}

		tableDef, ok := node.JoinMap[alias]
		if !ok {
			return fmt.Errorf("Invalid joinBy alias: '%s'. Allowed: %s", alias, joinMapKeysExcluding(node.JoinMap, "_"))
		}

		// Resolve join type: runtime entry > joinTypes default > "inner"
		joinType := "inner"
		if typeObj, ok := entry["type"]; ok {
			if typeStr, ok := typeObj.(string); ok && typeStr != "" {
				joinType = strings.ToLower(typeStr)
			}
		} else if defaultType, ok := node.JoinTypes[alias]; ok {
			joinType = strings.ToLower(defaultType)
		}

		if !validJoinTypes[joinType] {
			return fmt.Errorf("Invalid join type: '%s'. Allowed: inner, left, right, full, cross", joinType)
		}

		keyword := "JOIN"
		if joinType != "inner" {
			keyword = strings.ToUpper(joinType) + " JOIN"
		}

		qualifiedTable := fmt.Sprintf("\"%s\"", tableDef.Table)
		if tableDef.Schema != "" {
			qualifiedTable = fmt.Sprintf("\"%s\".\"%s\"", tableDef.Schema, tableDef.Table)
		}

		sqlAlias := extractAliasFromColumns(tableDef.Columns, alias)
		*sql = append(*sql, fmt.Sprintf(" %s %s as %s", keyword, qualifiedTable, sqlAlias))

		if joinType == "cross" {
			continue
		}

		// ON clause
		onObj, hasOn := entry["on"]
		if !hasOn {
			return fmt.Errorf("joinBy entry '%s' requires an 'on' array", alias)
		}
		conditions, ok := onObj.([]any)
		if !ok {
			return fmt.Errorf("joinBy entry '%s' 'on' must be an array of conditions", alias)
		}
		if len(conditions) == 0 {
			return fmt.Errorf("joinBy entry '%s' 'on' must have at least one condition", alias)
		}

		*sql = append(*sql, " ON ")

		for i, condObj := range conditions {
			if i > 0 {
				*sql = append(*sql, " AND ")
			}

			cond, ok := condObj.([]any)
			if !ok || len(cond) < 3 {
				return fmt.Errorf("joinBy ON condition must be a 3-tuple [leftCol, operator, rightCol]")
			}

			leftRef, _ := cond[0].(string)
			op, _ := cond[1].(string)
			rightRef, _ := cond[2].(string)

			if !validJoinOps[op] {
				return fmt.Errorf("Invalid joinBy ON operator: '%s'. Allowed: =, <, <=, >, >=, <>", op)
			}

			leftSQL, err := resolveJoinColRef(leftRef, node.JoinMap)
			if err != nil {
				return err
			}
			rightSQL, err := resolveJoinColRef(rightRef, node.JoinMap)
			if err != nil {
				return err
			}

			*sql = append(*sql, leftSQL, fmt.Sprintf(" %s ", op), rightSQL)
		}
	}
	return nil
}

// joinMapKeysExcluding returns joinMap keys as a comma-separated string, excluding the specified key.
func joinMapKeysExcluding(joinMap map[string]*JoinByTableDef, exclude string) string {
	var keys []string
	for k := range joinMap {
		if k != exclude {
			keys = append(keys, k)
		}
	}
	return strings.Join(keys, ", ")
}

// buildUpsert handles UpsertNode — emits INSERT ... ON CONFLICT (pg/sqlite) or MERGE (transactsql).
func (b *SqlBuilder) buildUpsert(node *UpsertNode, params map[string]any, sql *[]string, values *[]any) error {
	obj, exists := params[node.Param]
	if !exists {
		return nil
	}
	rows, err := coerceRowList(obj)
	if err != nil {
		return err
	}
	if len(rows) == 0 {
		return fmt.Errorf("insert/upsert requires a non-empty rows array")
	}

	keys := getCanonicalKeys(node.Columns, rows[0])
	conflictSet := make(map[string]bool, len(node.ConflictKeys))
	for _, ck := range node.ConflictKeys {
		conflictSet[ck] = true
	}

	if b.dialect == "transactsql" {
		return b.buildUpsertMssql(node, keys, conflictSet, rows, sql, values)
	}
	return b.buildUpsertPgSqlite(node, keys, conflictSet, rows, sql, values)
}

// buildUpsertPgSqlite emits PostgreSQL/SQLite ON CONFLICT syntax.
func (b *SqlBuilder) buildUpsertPgSqlite(node *UpsertNode, keys []string, conflictSet map[string]bool, rows []map[string]any, sql *[]string, values *[]any) error {
	// (col1, col2) VALUES (...) ON CONFLICT (pk) DO UPDATE SET col = EXCLUDED.col
	*sql = append(*sql, "(")
	for i, k := range keys {
		if i > 0 {
			*sql = append(*sql, ", ")
		}
		colSQL, _ := node.Columns.Get(k)
		*sql = append(*sql, colSQL)
	}
	*sql = append(*sql, ") values ")

	for r, row := range rows {
		if r > 0 {
			*sql = append(*sql, ", ")
		}
		*sql = append(*sql, "(")
		for i, k := range keys {
			if i > 0 {
				*sql = append(*sql, ", ")
			}
			*sql = append(*sql, b.formatParam())
			*values = append(*values, row[k])
		}
		*sql = append(*sql, ")")
	}

	*sql = append(*sql, " on conflict (")
	for i, ck := range node.ConflictKeys {
		if i > 0 {
			*sql = append(*sql, ", ")
		}
		colSQL, _ := node.Columns.Get(ck)
		*sql = append(*sql, colSQL)
	}
	*sql = append(*sql, ") do update set ")

	emitted := 0
	for _, key := range keys {
		if conflictSet[key] {
			continue
		}
		if emitted > 0 {
			*sql = append(*sql, ", ")
		}
		col, _ := node.Columns.Get(key)
		*sql = append(*sql, col, " = excluded.", col)
		emitted++
	}
	return nil
}

// buildUpsertMssql emits MERGE syntax for MS SQL Server.
func (b *SqlBuilder) buildUpsertMssql(node *UpsertNode, keys []string, conflictSet map[string]bool, rows []map[string]any, sql *[]string, values *[]any) error {
	// USING (VALUES (...)) AS src(cols) ON (t.pk = src.pk) WHEN MATCHED ... WHEN NOT MATCHED ...
	*sql = append(*sql, "using (values ")
	for r, row := range rows {
		if r > 0 {
			*sql = append(*sql, ", ")
		}
		*sql = append(*sql, "(")
		for i, k := range keys {
			if i > 0 {
				*sql = append(*sql, ", ")
			}
			*sql = append(*sql, b.formatParam())
			*values = append(*values, row[k])
		}
		*sql = append(*sql, ")")
	}
	*sql = append(*sql, ") as src(")
	for i, k := range keys {
		if i > 0 {
			*sql = append(*sql, ", ")
		}
		colSQL, _ := node.Columns.Get(k)
		*sql = append(*sql, colSQL)
	}
	*sql = append(*sql, ") on (")

	// ON clause
	for i, ck := range node.ConflictKeys {
		if i > 0 {
			*sql = append(*sql, " and ")
		}
		col, _ := node.Columns.Get(ck)
		*sql = append(*sql, node.TableName, ".", col, " = src.", col)
	}
	*sql = append(*sql, ") when matched then update set ")

	// SET col = src.col (non-conflict)
	emitted := 0
	for _, key := range keys {
		if conflictSet[key] {
			continue
		}
		if emitted > 0 {
			*sql = append(*sql, ", ")
		}
		col, _ := node.Columns.Get(key)
		*sql = append(*sql, col, " = src.", col)
		emitted++
	}

	// WHEN NOT MATCHED
	*sql = append(*sql, " when not matched then insert (")
	for i, k := range keys {
		if i > 0 {
			*sql = append(*sql, ", ")
		}
		colSQL, _ := node.Columns.Get(k)
		*sql = append(*sql, colSQL)
	}
	*sql = append(*sql, ") values (")
	for i, k := range keys {
		if i > 0 {
			*sql = append(*sql, ", ")
		}
		colSQL, _ := node.Columns.Get(k)
		*sql = append(*sql, "src.", colSQL)
	}
	*sql = append(*sql, ")")
	return nil
}

// ─── Window Functions ────────────────────────────────────────────────────────

var validWindowFunctions = map[string]bool{
	"row_number": true, "rank": true, "dense_rank": true, "percent_rank": true, "cume_dist": true,
	"ntile": true,
	"sum": true, "avg": true, "count": true, "min": true, "max": true, "first_value": true, "last_value": true,
	"lag": true, "lead": true,
}

var rankingFunctions = map[string]bool{
	"row_number": true, "rank": true, "dense_rank": true, "percent_rank": true, "cume_dist": true,
}

var aggregateFunctions = map[string]bool{
	"sum": true, "avg": true, "count": true, "min": true, "max": true, "first_value": true, "last_value": true,
}

var offsetFunctions = map[string]bool{
	"lag": true, "lead": true,
}

// buildWindowBy handles WindowByNode — emits window function expressions appended to SELECT.
func (b *SqlBuilder) buildWindowBy(node *WindowByNode, params map[string]any, sql *[]string) error {
	obj, exists := params[node.Param]
	if !exists || obj == nil {
		return nil
	}

	// Extract ordered entries
	var aliases []string
	var getEntry func(string) (map[string]any, bool)

	switch v := obj.(type) {
	case *OrderedDict:
		if v.Len() == 0 {
			return nil
		}
		aliases = v.OrderedKeys()
		getEntry = func(key string) (map[string]any, bool) {
			val, ok := v.Get(key)
			if !ok {
				return nil, false
			}
			switch e := val.(type) {
			case map[string]any:
				return e, true
			case *OrderedDict:
				return e.ToMap(), true
			}
			return nil, false
		}
	case map[string]any:
		if len(v) == 0 {
			return nil
		}
		// Use node.Columns.Keys order for determinism
		for _, key := range node.Columns.Keys {
			if _, ok := v[key]; ok {
				aliases = append(aliases, key)
			}
		}
		// Also add any keys not in columns (shouldn't happen but be safe)
		for key := range v {
			found := false
			for _, a := range aliases {
				if a == key {
					found = true
					break
				}
			}
			if !found {
				aliases = append(aliases, key)
			}
		}
		getEntry = func(key string) (map[string]any, bool) {
			val, ok := v[key]
			if !ok {
				return nil, false
			}
			switch e := val.(type) {
			case map[string]any:
				return e, true
			case *OrderedDict:
				return e.ToMap(), true
			}
			return nil, false
		}
	default:
		return nil
	}

	for _, alias := range aliases {
		def, ok := getEntry(alias)
		if !ok {
			continue
		}

		fnObj, hasFn := def["fn"]
		fn, fnIsStr := fnObj.(string)
		if !hasFn || !fnIsStr || fn == "" {
			return fmt.Errorf("windowBy: each entry requires a 'fn' property")
		}
		if !validWindowFunctions[fn] {
			return fmt.Errorf("windowBy: invalid function '%s'", fn)
		}

		*sql = append(*sql, ", ")

		// Emit function call
		if err := b.writeWindowFunctionCall(fn, def, node.Columns, sql); err != nil {
			return err
		}

		// Emit OVER clause
		*sql = append(*sql, " over (")
		if err := b.writeWindowOverClause(def, node.Columns, sql); err != nil {
			return err
		}
		*sql = append(*sql, ")")

		// Emit alias
		*sql = append(*sql, fmt.Sprintf(` as "%s"`, strings.ReplaceAll(alias, `"`, `""`)))
	}
	return nil
}

func (b *SqlBuilder) writeWindowFunctionCall(fn string, def map[string]any, columns *OrderedMap, sql *[]string) error {
	if rankingFunctions[fn] {
		*sql = append(*sql, fn+"()")
		return nil
	}

	if fn == "ntile" {
		argsObj, has := def["args"]
		if !has || argsObj == nil {
			return fmt.Errorf("windowBy: ntile requires 'args' (positive integer bucket count)")
		}
		args := toInt(argsObj)
		if args <= 0 {
			return fmt.Errorf("windowBy: ntile 'args' must be a positive integer, got %v", argsObj)
		}
		*sql = append(*sql, fmt.Sprintf("ntile(%d)", args))
		return nil
	}

	if aggregateFunctions[fn] {
		colObj, has := def["col"]
		col, isStr := colObj.(string)
		if !has || !isStr || col == "" {
			return fmt.Errorf("windowBy: aggregate function '%s' requires 'col'", fn)
		}
		*sql = append(*sql, fn+"(")
		if col == "*" {
			*sql = append(*sql, "*")
		} else {
			*sql = append(*sql, resolveWindowColumn(col, columns))
		}
		*sql = append(*sql, ")")
		return nil
	}

	if offsetFunctions[fn] {
		colObj, has := def["col"]
		col, isStr := colObj.(string)
		if !has || !isStr || col == "" {
			return fmt.Errorf("windowBy: offset function '%s' requires 'col'", fn)
		}
		offset := 1
		if argsObj, has := def["args"]; has && argsObj != nil {
			offset = toInt(argsObj)
			if offset <= 0 {
				offset = 1
			}
		}
		*sql = append(*sql, fmt.Sprintf("%s(", fn))
		*sql = append(*sql, resolveWindowColumn(col, columns))
		*sql = append(*sql, fmt.Sprintf(", %d)", offset))
		return nil
	}

	return nil
}

func (b *SqlBuilder) writeWindowOverClause(def map[string]any, columns *OrderedMap, sql *[]string) error {
	overObj, has := def["over"]
	if !has || overObj == nil {
		return nil
	}
	over, ok := overObj.(map[string]any)
	if !ok {
		if od, ok := overObj.(*OrderedDict); ok {
			over = od.ToMap()
		} else {
			return nil
		}
	}

	hasContent := false

	// PARTITION BY
	if partObj, has := over["partitionBy"]; has {
		if partCols, ok := partObj.([]any); ok && len(partCols) > 0 {
			*sql = append(*sql, "partition by ")
			for i, colObj := range partCols {
				if i > 0 {
					*sql = append(*sql, ", ")
				}
				col, _ := colObj.(string)
				*sql = append(*sql, resolveWindowColumn(col, columns))
			}
			hasContent = true
		}
	}

	// ORDER BY
	if ordObj, has := over["orderBy"]; has {
		var ordKeys []string
		var getDir func(string) string

		switch v := ordObj.(type) {
		case *OrderedDict:
			if v.Len() > 0 {
				ordKeys = v.OrderedKeys()
				getDir = func(key string) string {
					val, _ := v.Get(key)
					s, _ := val.(string)
					return s
				}
			}
		case map[string]any:
			if len(v) > 0 {
				// Use columns order for determinism
				for _, key := range columns.Keys {
					if _, ok := v[key]; ok {
						ordKeys = append(ordKeys, key)
					}
				}
				getDir = func(key string) string {
					s, _ := v[key].(string)
					return s
				}
			}
		}

		if len(ordKeys) > 0 {
			if hasContent {
				*sql = append(*sql, " ")
			}
			*sql = append(*sql, "order by ")
			emitted := 0
			for _, col := range ordKeys {
				dir := getDir(col)
				if dir == "" {
					dir = "ASC"
				}
				dir = strings.ToUpper(dir)
				if dir != "ASC" && dir != "DESC" {
					return fmt.Errorf("windowBy: invalid orderBy direction '%s'. Must be ASC or DESC.", dir)
				}
				if emitted > 0 {
					*sql = append(*sql, ", ")
				}
				*sql = append(*sql, resolveWindowColumn(col, columns))
				*sql = append(*sql, " ", dir)
				emitted++
			}
			hasContent = true
		}
	}

	// FRAME clause
	startObj, hasStart := over["start"]
	endObj, hasEnd := over["end"]
	if (hasStart && startObj != nil) || (hasEnd && endObj != nil) {
		frameObj, hasFrame := over["frame"]
		frame, _ := frameObj.(string)
		if !hasFrame || (frame != "rows" && frame != "range") {
			return fmt.Errorf("windowBy: 'frame' (rows|range) is required when start/end are specified")
		}
		// MSSQL validation
		if frame == "range" && b.dialect == "transactsql" {
			startIsNum := isNumeric(startObj)
			endIsNum := isNumeric(endObj)
			if startIsNum || endIsNum {
				return fmt.Errorf("windowBy: MSSQL does not support numeric bounds with RANGE frame. Use frame: \"rows\" instead.")
			}
		}
		if hasContent {
			*sql = append(*sql, " ")
		}
		*sql = append(*sql, frame, " between ")
		*sql = append(*sql, formatFrameBound(startObj, "start"))
		*sql = append(*sql, " and ")
		*sql = append(*sql, formatFrameBound(endObj, "end"))
	}

	return nil
}

// resolveWindowColumn resolves a column key to its SQL expression, stripping the alias suffix.
func resolveWindowColumn(col string, columns *OrderedMap) string {
	if colSQL, ok := columns.Get(col); ok {
		// Strip ' as "alias"' suffix — we need the raw column reference
		idx := strings.Index(strings.ToLower(colSQL), " as \"")
		if idx > 0 {
			return colSQL[:idx]
		}
		return colSQL
	}
	// Fallback: emit quoted identifier
	return fmt.Sprintf(`"%s"`, strings.ReplaceAll(col, `"`, `""`))
}

// formatFrameBound formats a window frame bound.
func formatFrameBound(bound any, position string) string {
	switch v := bound.(type) {
	case string:
		if v == "unbounded preceding" || v == "unbounded following" || v == "current row" {
			return v
		}
		// Try parsing as number
		if n, err := fmt.Sscanf(v, "%d", new(int)); err == nil && n == 1 {
			var num int
			fmt.Sscanf(v, "%d", &num)
			return formatNumericBound(num, position)
		}
		return v
	case float64:
		return formatNumericBound(int(v), position)
	case int:
		return formatNumericBound(v, position)
	case int64:
		return formatNumericBound(int(v), position)
	case nil:
		if position == "start" {
			return "unbounded preceding"
		}
		return "unbounded following"
	default:
		return "current row"
	}
}

func formatNumericBound(num int, position string) string {
	if num == 0 {
		return "current row"
	}
	if position == "start" {
		return fmt.Sprintf("%d preceding", num)
	}
	return fmt.Sprintf("%d following", num)
}

// toInt converts a numeric value to int.
func toInt(v any) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case int64:
		return int(n)
	default:
		return 0
	}
}

// isNumeric checks if a value is a numeric type.
func isNumeric(v any) bool {
	switch v.(type) {
	case int, int64, float64:
		return true
	default:
		return false
	}
}
