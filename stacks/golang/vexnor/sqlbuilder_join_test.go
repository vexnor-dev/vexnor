package vexnor_test

import (
	"strings"
	"testing"

	"github.com/vexnor-dev/vexnor-go/vexnor"
)

func TestBuildJoinBy_InvalidAlias(t *testing.T) {
	t.Run("invalid alias returns error with allowed keys", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.JoinByNode{
					Param: "joinBy",
					JoinMap: map[string]*vexnor.JoinByTableDef{
						"_": {
							Schema:  "public",
							Table:   "accounts",
							Columns: makeColumns("id", `"a_0"."id"`),
						},
						"order": {
							Schema:  "public",
							Table:   "orders",
							Columns: makeColumns("orderId", `"o_1"."order_id"`),
						},
					},
					JoinTypes: map[string]string{},
				},
			},
		}

		result := map[string]any{
			"joinBy": map[string]any{
				"badAlias": map[string]any{
					"on": []any{[]any{"_.id", "=", "badAlias.orderId"}},
				},
			},
		}

		_, err := builder.Build(query, result)
		if err == nil {
			t.Fatal("expected error for invalid alias")
		}
		if !strings.Contains(err.Error(), "Invalid joinBy alias") {
			t.Errorf("expected 'Invalid joinBy alias' message, got %q", err.Error())
		}
	})
}

func TestBuildJoinBy_MissingOn(t *testing.T) {
	t.Run("missing on array returns error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.JoinByNode{
					Param: "joinBy",
					JoinMap: map[string]*vexnor.JoinByTableDef{
						"_": {
							Schema:  "public",
							Table:   "accounts",
							Columns: makeColumns("id", `"a_0"."id"`),
						},
						"order": {
							Schema:  "public",
							Table:   "orders",
							Columns: makeColumns("accountId", `"o_1"."account_id"`),
						},
					},
					JoinTypes: map[string]string{},
				},
			},
		}

		_, err := builder.Build(query, map[string]any{
			"joinBy": map[string]any{
				"order": map[string]any{},
			},
		})
		if err == nil {
			t.Fatal("expected error for missing on")
		}
		if !strings.Contains(err.Error(), "requires an 'on' array") {
			t.Errorf("expected 'requires an on array' message, got %q", err.Error())
		}
	})
}

func TestBuildJoinBy_InvalidOnOperator(t *testing.T) {
	t.Run("invalid ON operator returns error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.JoinByNode{
					Param: "joinBy",
					JoinMap: map[string]*vexnor.JoinByTableDef{
						"_": {
							Schema:  "public",
							Table:   "accounts",
							Columns: makeColumns("id", `"a_0"."id"`),
						},
						"order": {
							Schema:  "public",
							Table:   "orders",
							Columns: makeColumns("accountId", `"o_1"."account_id"`),
						},
					},
					JoinTypes: map[string]string{},
				},
			},
		}

		_, err := builder.Build(query, map[string]any{
			"joinBy": map[string]any{
				"order": map[string]any{
					"on": []any{[]any{"_.id", "LIKE", "order.accountId"}},
				},
			},
		})
		if err == nil {
			t.Fatal("expected error for invalid ON operator")
		}
		if !strings.Contains(err.Error(), "Invalid joinBy ON operator") {
			t.Errorf("expected 'Invalid joinBy ON operator' message, got %q", err.Error())
		}
	})
}

func TestBuildJoinBy_InvalidColRef(t *testing.T) {
	t.Run("column ref without dot returns error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.JoinByNode{
					Param: "joinBy",
					JoinMap: map[string]*vexnor.JoinByTableDef{
						"_": {
							Schema:  "public",
							Table:   "accounts",
							Columns: makeColumns("id", `"a_0"."id"`),
						},
						"order": {
							Schema:  "public",
							Table:   "orders",
							Columns: makeColumns("accountId", `"o_1"."account_id"`),
						},
					},
					JoinTypes: map[string]string{},
				},
			},
		}

		_, err := builder.Build(query, map[string]any{
			"joinBy": map[string]any{
				"order": map[string]any{
					"on": []any{[]any{"noDotRef", "=", "order.accountId"}},
				},
			},
		})
		if err == nil {
			t.Fatal("expected error for ref without dot")
		}
		if !strings.Contains(err.Error(), "invalid column reference") {
			t.Errorf("expected 'invalid column reference' message, got %q", err.Error())
		}
	})
}

func TestBuildJoinBy_InvalidColRefPrefix(t *testing.T) {
	t.Run("column ref with unknown prefix returns error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.JoinByNode{
					Param: "joinBy",
					JoinMap: map[string]*vexnor.JoinByTableDef{
						"_": {
							Schema:  "public",
							Table:   "accounts",
							Columns: makeColumns("id", `"a_0"."id"`),
						},
						"order": {
							Schema:  "public",
							Table:   "orders",
							Columns: makeColumns("accountId", `"o_1"."account_id"`),
						},
					},
					JoinTypes: map[string]string{},
				},
			},
		}

		_, err := builder.Build(query, map[string]any{
			"joinBy": map[string]any{
				"order": map[string]any{
					"on": []any{[]any{"unknown.id", "=", "order.accountId"}},
				},
			},
		})
		if err == nil {
			t.Fatal("expected error for unknown prefix")
		}
		if !strings.Contains(err.Error(), "invalid column reference prefix") {
			t.Errorf("expected 'invalid column reference prefix' message, got %q", err.Error())
		}
	})
}

func TestBuildJoinBy_InvalidColumn(t *testing.T) {
	t.Run("valid prefix but invalid column key returns error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.JoinByNode{
					Param: "joinBy",
					JoinMap: map[string]*vexnor.JoinByTableDef{
						"_": {
							Schema:  "public",
							Table:   "accounts",
							Columns: makeColumns("id", `"a_0"."id"`),
						},
						"order": {
							Schema:  "public",
							Table:   "orders",
							Columns: makeColumns("accountId", `"o_1"."account_id"`),
						},
					},
					JoinTypes: map[string]string{},
				},
			},
		}

		_, err := builder.Build(query, map[string]any{
			"joinBy": map[string]any{
				"order": map[string]any{
					"on": []any{[]any{"_.badCol", "=", "order.accountId"}},
				},
			},
		})
		if err == nil {
			t.Fatal("expected error for invalid column key")
		}
		if !strings.Contains(err.Error(), "invalid column") {
			t.Errorf("expected 'invalid column' message, got %q", err.Error())
		}
	})
}

func TestBuildJoinBy_CrossJoinSkipsOn(t *testing.T) {
	t.Run("cross join skips ON clause", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.JoinByNode{
					Param: "joinBy",
					JoinMap: map[string]*vexnor.JoinByTableDef{
						"_": {
							Schema:  "public",
							Table:   "accounts",
							Columns: makeColumns("id", `"a_0"."id"`),
						},
						"ref": {
							Schema:  "",
							Table:   "reference",
							Columns: makeColumns("code", `"r_1"."code"`),
						},
					},
					JoinTypes: map[string]string{},
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"joinBy": map[string]any{
				"ref": map[string]any{
					"type": "cross",
				},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !strings.Contains(result.Text, "CROSS JOIN") {
			t.Errorf("expected CROSS JOIN, got %q", result.Text)
		}
		if strings.Contains(result.Text, "ON") {
			t.Errorf("cross join should not have ON clause, got %q", result.Text)
		}
	})
}

func TestBuildJoinBy_EmptyOnArray(t *testing.T) {
	t.Run("empty on array returns error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.JoinByNode{
					Param: "joinBy",
					JoinMap: map[string]*vexnor.JoinByTableDef{
						"_": {
							Schema:  "public",
							Table:   "accounts",
							Columns: makeColumns("id", `"a_0"."id"`),
						},
						"order": {
							Schema:  "public",
							Table:   "orders",
							Columns: makeColumns("accountId", `"o_1"."account_id"`),
						},
					},
					JoinTypes: map[string]string{},
				},
			},
		}

		_, err := builder.Build(query, map[string]any{
			"joinBy": map[string]any{
				"order": map[string]any{
					"on": []any{},
				},
			},
		})
		if err == nil {
			t.Fatal("expected error for empty on array")
		}
		if !strings.Contains(err.Error(), "must have at least one condition") {
			t.Errorf("expected 'at least one condition' message, got %q", err.Error())
		}
	})
}

func TestBuildSet_WithOrderedDict(t *testing.T) {
	t.Run("set with OrderedDict preserves order", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.SetNode{
					Param:   "set",
					Columns: makeColumns("name", `"name"`, "email", `"email"`, "age", `"age"`),
				},
			},
		}

		od := vexnor.NewOrderedDict()
		od.Set("age", 30)
		od.Set("name", "Jane")

		result, err := builder.Build(query, map[string]any{
			"set": od,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// OrderedDict order: age first, then name
		if result.Text != `set "age" = $1, "name" = $2` {
			t.Errorf("expected ordered set, got %q", result.Text)
		}
	})
}

func TestBuildSet_EmptyOrderedDict(t *testing.T) {
	t.Run("set with empty OrderedDict returns error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.SetNode{
					Param:   "set",
					Columns: makeColumns("name", `"name"`),
				},
			},
		}

		od := vexnor.NewOrderedDict()
		_, err := builder.Build(query, map[string]any{
			"set": od,
		})
		if err == nil {
			t.Fatal("expected error for empty OrderedDict")
		}
		if !strings.Contains(err.Error(), "at least one column") {
			t.Errorf("expected 'at least one column' message, got %q", err.Error())
		}
	})
}

func TestBuildSet_NilParam(t *testing.T) {
	t.Run("set with nil param returns error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.SetNode{
					Param:   "set",
					Columns: makeColumns("name", `"name"`),
				},
			},
		}

		_, err := builder.Build(query, map[string]any{"set": nil})
		if err == nil {
			t.Fatal("expected error for nil set param")
		}
	})
}

func TestBuildSet_UnsupportedType(t *testing.T) {
	t.Run("set with unsupported type returns error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.SetNode{
					Param:   "set",
					Columns: makeColumns("name", `"name"`),
				},
			},
		}

		_, err := builder.Build(query, map[string]any{"set": "not-a-map"})
		if err == nil {
			t.Fatal("expected error for string type")
		}
		if !strings.Contains(err.Error(), "requires a non-empty object") {
			t.Errorf("expected 'requires a non-empty object', got %q", err.Error())
		}
	})
}

func TestBuildFilter_WithOrderedDict(t *testing.T) {
	t.Run("filter with OrderedDict input", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		prefix := " WHERE "
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.FilterNode{
					Param:   "filterBy",
					Columns: makeColumns("name", `"name"`, "status", `"status"`),
					Prefix:  &prefix,
				},
			},
		}

		od := vexnor.NewOrderedDict()
		od.Set("status", "active")
		od.Set("name", "Jane")

		result, err := builder.Build(query, map[string]any{
			"filterBy": od,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// OrderedDict ordering
		expected := ` WHERE "status" = $1 and "name" = $2`
		if result.Text != expected {
			t.Errorf("expected %q, got %q", expected, result.Text)
		}
	})
}

func TestCoerceRowList_WithOrderedDictInArray(t *testing.T) {
	t.Run("coerceRowList handles OrderedDict in []any", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")

		od := vexnor.NewOrderedDict()
		od.Set("email", "test@test.com")
		od.Set("name", "Test")

		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.InsertNode{
					Param:   "rows",
					Columns: makeColumns("email", `"email"`, "name", `"name"`),
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"rows": []any{od},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !strings.Contains(result.Text, `("email", "name") values ($1, $2)`) {
			t.Errorf("expected insert with ordered cols, got %q", result.Text)
		}
	})
}

func TestExtractAliasFromColumns_EmptyColumns(t *testing.T) {
	t.Run("empty columns falls back to quoted fallback", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.JoinByNode{
					Param: "joinBy",
					JoinMap: map[string]*vexnor.JoinByTableDef{
						"_": {
							Schema:  "public",
							Table:   "accounts",
							Columns: makeColumns("id", `"a_0"."id"`),
						},
						"empty": {
							Schema:  "public",
							Table:   "empty_table",
							Columns: vexnor.NewOrderedMap(), // empty columns
						},
					},
					JoinTypes: map[string]string{},
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"joinBy": map[string]any{
				"empty": map[string]any{
					"type": "cross",
				},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// With empty columns, alias should be fallback: "empty"
		if !strings.Contains(result.Text, `as "empty"`) {
			t.Errorf("expected fallback alias, got %q", result.Text)
		}
	})
}

func TestExtractAliasFromColumns_NoDot(t *testing.T) {
	t.Run("column value without dot uses fallback", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.JoinByNode{
					Param: "joinBy",
					JoinMap: map[string]*vexnor.JoinByTableDef{
						"_": {
							Schema:  "public",
							Table:   "accounts",
							Columns: makeColumns("id", `"a_0"."id"`),
						},
						"flat": {
							Schema:  "",
							Table:   "flat_table",
							Columns: makeColumns("col", `noDotValue`),
						},
					},
					JoinTypes: map[string]string{},
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"joinBy": map[string]any{
				"flat": map[string]any{
					"type": "cross",
				},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !strings.Contains(result.Text, `as "flat"`) {
			t.Errorf("expected fallback alias for no-dot column, got %q", result.Text)
		}
	})
}

func TestBuildJoinBy_WithOrderedDict(t *testing.T) {
	t.Run("joinBy with OrderedDict param preserves order", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.JoinByNode{
					Param: "joinBy",
					JoinMap: map[string]*vexnor.JoinByTableDef{
						"_": {
							Schema:  "public",
							Table:   "accounts",
							Columns: makeColumns("id", `"a_0"."id"`),
						},
						"alpha": {
							Schema:  "public",
							Table:   "alpha_table",
							Columns: makeColumns("aid", `"al_1"."aid"`),
						},
						"beta": {
							Schema:  "public",
							Table:   "beta_table",
							Columns: makeColumns("bid", `"be_2"."bid"`),
						},
					},
					JoinTypes: map[string]string{"alpha": "left"},
				},
			},
		}

		od := vexnor.NewOrderedDict()
		betaEntry := vexnor.NewOrderedDict()
		betaEntry.Set("on", []any{[]any{"_.id", "=", "beta.bid"}})
		od.Set("beta", betaEntry)

		alphaEntry := vexnor.NewOrderedDict()
		alphaEntry.Set("on", []any{[]any{"_.id", "=", "alpha.aid"}})
		od.Set("alpha", alphaEntry)

		result, err := builder.Build(query, map[string]any{"joinBy": od})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// beta first, then alpha (OrderedDict order)
		betaIdx := strings.Index(result.Text, "beta_table")
		alphaIdx := strings.Index(result.Text, "alpha_table")
		if betaIdx > alphaIdx {
			t.Errorf("expected beta before alpha, got %q", result.Text)
		}
		// alpha should use default join type "left" from JoinTypes
		if !strings.Contains(result.Text, "LEFT JOIN") {
			t.Errorf("expected LEFT JOIN from JoinTypes default, got %q", result.Text)
		}
	})
}

func TestBuildJoinBy_InvalidJoinType(t *testing.T) {
	t.Run("invalid join type returns error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.JoinByNode{
					Param: "joinBy",
					JoinMap: map[string]*vexnor.JoinByTableDef{
						"_": {
							Schema:  "public",
							Table:   "accounts",
							Columns: makeColumns("id", `"a_0"."id"`),
						},
						"order": {
							Schema:  "public",
							Table:   "orders",
							Columns: makeColumns("accountId", `"o_1"."account_id"`),
						},
					},
					JoinTypes: map[string]string{},
				},
			},
		}

		_, err := builder.Build(query, map[string]any{
			"joinBy": map[string]any{
				"order": map[string]any{
					"type": "diagonal",
					"on":   []any{[]any{"_.id", "=", "order.accountId"}},
				},
			},
		})
		if err == nil {
			t.Fatal("expected error for invalid join type")
		}
		if !strings.Contains(err.Error(), "Invalid join type") {
			t.Errorf("expected 'Invalid join type' message, got %q", err.Error())
		}
	})
}
