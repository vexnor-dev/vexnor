package vexnor_test

import (
	"strings"
	"testing"

	"github.com/vexnor-dev/vexnor/stacks/golang/vexnor"
)

func TestCoerceRowList_EmptySliceOfMaps(t *testing.T) {
	t.Run("empty []map[string]any returns nil rows and insert fails", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.InsertNode{
					Param:   "rows",
					Columns: makeColumns("name", `"name"`),
				},
			},
		}

		_, err := builder.Build(query, map[string]any{
			"rows": []map[string]any{},
		})
		if err == nil {
			t.Fatal("expected error for empty rows")
		}
		if !strings.Contains(err.Error(), "non-empty rows") {
			t.Errorf("expected non-empty rows error, got %q", err.Error())
		}
	})
}

func TestCoerceRowList_DirectSliceOfMaps(t *testing.T) {
	t.Run("[]map[string]any is accepted directly", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.InsertNode{
					Param:   "rows",
					Columns: makeColumns("name", `"name"`, "age", `"age"`),
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"rows": []map[string]any{
				{"name": "Alice", "age": 30},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !strings.Contains(result.Text, `("name", "age") values ($1, $2)`) {
			t.Errorf("unexpected result: %q", result.Text)
		}
	})
}

func TestCoerceRowList_UnsupportedType(t *testing.T) {
	t.Run("unsupported type for rows triggers non-empty rows error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.InsertNode{
					Param:   "rows",
					Columns: makeColumns("name", `"name"`),
				},
			},
		}

		// Passing string — coerceRowList returns nil, buildInsert errors
		_, err := builder.Build(query, map[string]any{
			"rows": "not-a-valid-type",
		})
		if err == nil {
			t.Fatal("expected error for unsupported type")
		}
		if !strings.Contains(err.Error(), "non-empty rows") {
			t.Errorf("expected non-empty rows error, got %q", err.Error())
		}
	})
}

func TestCoerceRowList_EmptyAnySlice(t *testing.T) {
	t.Run("[]any with no map items triggers non-empty rows error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.InsertNode{
					Param:   "rows",
					Columns: makeColumns("name", `"name"`),
				},
			},
		}

		// []any with non-map items — coerceRowList produces empty result, buildInsert errors
		_, err := builder.Build(query, map[string]any{
			"rows": []any{"not-a-map"},
		})
		if err == nil {
			t.Fatal("expected error for non-map items")
		}
		if !strings.Contains(err.Error(), "non-empty rows") {
			t.Errorf("expected non-empty rows error, got %q", err.Error())
		}
	})
}

func TestBuildFilter_MapForm(t *testing.T) {
	t.Run("filter with map[string]any iterates by Columns.Keys order", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		suffix := " -- end"
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.FilterNode{
					Param:   "filterBy",
					Columns: makeColumns("name", `"name"`, "status", `"status"`),
					Suffix:  &suffix,
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"filterBy": map[string]any{
				"status": "active",
				"name":   "Jane",
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// Order follows Columns.Keys: name first, status second
		expected := `"name" = $1 and "status" = $2 -- end`
		if result.Text != expected {
			t.Errorf("expected %q, got %q", expected, result.Text)
		}
	})
}

func TestBuildFilter_NilFilterByValue(t *testing.T) {
	t.Run("filter with nil value for a column skips it", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.FilterNode{
					Param:   "filterBy",
					Columns: makeColumns("name", `"name"`, "status", `"status"`),
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"filterBy": map[string]any{
				"name":   nil,
				"status": "active",
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != `"status" = $1` {
			t.Errorf("expected only status, got %q", result.Text)
		}
	})
}

func TestBuildFilter_EmptyConditions(t *testing.T) {
	t.Run("filter with all nil values emits nothing", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.FilterNode{
					Param:   "filterBy",
					Columns: makeColumns("name", `"name"`),
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"filterBy": map[string]any{"name": nil},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != "" {
			t.Errorf("expected empty output, got %q", result.Text)
		}
	})
}

func TestBuildFilter_OrderedDictWithNilValue(t *testing.T) {
	t.Run("filter OrderedDict with nil value skips it", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.FilterNode{
					Param:   "filterBy",
					Columns: makeColumns("name", `"name"`, "status", `"status"`),
				},
			},
		}

		od := vexnor.NewOrderedDict()
		od.Set("name", nil)
		od.Set("status", "active")

		result, err := builder.Build(query, map[string]any{
			"filterBy": od,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != `"status" = $1` {
			t.Errorf("expected only status, got %q", result.Text)
		}
	})
}

func TestBuildWhen_WithNegate(t *testing.T) {
	t.Run("when with negate=true and absent param fires onTrue", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.WhenNode{
					Param:   "flag",
					Negate:  true,
					OnTrue:  vexnor.TemplateNodes{&vexnor.TextNode{Value: "TRUE_BRANCH"}},
					OnFalse: vexnor.TemplateNodes{&vexnor.TextNode{Value: "FALSE_BRANCH"}},
				},
			},
		}

		// flag is absent → isPresent=false → negate → flag=true → onTrue
		result, err := builder.Build(query, map[string]any{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != "TRUE_BRANCH" {
			t.Errorf("expected TRUE_BRANCH, got %q", result.Text)
		}
	})

	t.Run("when with negate=true and present param fires onFalse", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.WhenNode{
					Param:   "flag",
					Negate:  true,
					OnTrue:  vexnor.TemplateNodes{&vexnor.TextNode{Value: "TRUE_BRANCH"}},
					OnFalse: vexnor.TemplateNodes{&vexnor.TextNode{Value: "FALSE_BRANCH"}},
				},
			},
		}

		// flag is present → isPresent=true → negate → flag=false → onFalse
		result, err := builder.Build(query, map[string]any{"flag": "yes"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != "FALSE_BRANCH" {
			t.Errorf("expected FALSE_BRANCH, got %q", result.Text)
		}
	})
}

func TestBuildNodes_ValueNode(t *testing.T) {
	t.Run("ValueNode emits placeholder and value", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.TextNode{Value: "SELECT * FROM t WHERE x = "},
				&vexnor.ValueNode{Value: "literal_val"},
			},
		}

		result, err := builder.Build(query, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != "SELECT * FROM t WHERE x = $1" {
			t.Errorf("unexpected text: %q", result.Text)
		}
		if len(result.Values) != 1 || result.Values[0] != "literal_val" {
			t.Errorf("unexpected values: %v", result.Values)
		}
	})
}

func TestBuildPagination_OffsetOnly(t *testing.T) {
	t.Run("pagination with offset only", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.PaginationNode{},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"offset": 10,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != "offset $1" {
			t.Errorf("expected 'offset $1', got %q", result.Text)
		}
	})
}

func TestBuildPagination_NilValues(t *testing.T) {
	t.Run("pagination with nil limit and nil offset emits nothing", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.PaginationNode{},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"limit":  nil,
			"offset": nil,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != "" {
			t.Errorf("expected empty text, got %q", result.Text)
		}
	})
}

func TestBuildSet_EmptyMap(t *testing.T) {
	t.Run("set with empty map returns error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.SetNode{
					Param:   "set",
					Columns: makeColumns("name", `"name"`),
				},
			},
		}

		_, err := builder.Build(query, map[string]any{
			"set": map[string]any{},
		})
		if err == nil {
			t.Fatal("expected error for empty map")
		}
		if !strings.Contains(err.Error(), "at least one column") {
			t.Errorf("expected 'at least one column', got %q", err.Error())
		}
	})
}

func TestBuildFilter_OrGroupInArray(t *testing.T) {
	t.Run("OR group inside filter array", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.FilterNode{
					Param:   "filterBy",
					Columns: makeColumns("name", `"name"`, "email", `"email"`),
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"filterBy": []any{
				map[string]any{"name": "Jane"},
				map[string]any{
					"or": []any{
						map[string]any{"email": []any{"like", "%@a.com"}},
						map[string]any{"email": []any{"like", "%@b.com"}},
					},
				},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !strings.Contains(result.Text, `"name" = $1 and ("email" like $2 or "email" like $3)`) {
			t.Errorf("unexpected result: %q", result.Text)
		}
	})
}

func TestBuildInsertCols_MissingParam(t *testing.T) {
	t.Run("missing param emits nothing", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.InsertColsNode{
					Param:   "rows",
					Columns: makeColumns("name", `"name"`),
				},
			},
		}

		result, err := builder.Build(query, map[string]any{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != "" {
			t.Errorf("expected empty output, got %q", result.Text)
		}
	})
}

func TestBuildInsertValues_MissingParam(t *testing.T) {
	t.Run("missing param emits nothing", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.InsertValuesNode{
					Param: "rows",
					Keys:  []string{"name"},
				},
			},
		}

		result, err := builder.Build(query, map[string]any{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != "" {
			t.Errorf("expected empty output, got %q", result.Text)
		}
	})
}

func TestBuildUpsert_Sqlite(t *testing.T) {
	t.Run("upsert with sqlite dialect uses ON CONFLICT", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("sqlite")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.UpsertNode{
					Param:        "rows",
					Columns:      makeColumns("id", `"id"`, "name", `"name"`),
					ConflictKeys: []string{"id"},
					TableName:    "accounts",
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"rows": []any{
				map[string]any{"id": "1", "name": "Alice"},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !strings.Contains(result.Text, "on conflict") {
			t.Errorf("expected ON CONFLICT syntax, got %q", result.Text)
		}
	})
}

func TestBuildJoinBy_SchemalessTable(t *testing.T) {
	t.Run("joinBy with empty schema omits schema prefix", func(t *testing.T) {
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
							Columns: makeColumns("accountId", `"r_1"."account_id"`),
						},
					},
					JoinTypes: map[string]string{},
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"joinBy": map[string]any{
				"ref": map[string]any{
					"on": []any{[]any{"_.id", "=", "ref.accountId"}},
				},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// No schema prefix for empty schema
		if strings.Contains(result.Text, `"".`) {
			t.Errorf("should not have empty schema prefix, got %q", result.Text)
		}
		if !strings.Contains(result.Text, `"reference"`) {
			t.Errorf("expected table name, got %q", result.Text)
		}
	})
}

func TestWriteOp_AllComparisonOperators(t *testing.T) {
	tests := []struct {
		op       string
		expected string
	}{
		{"not", `"x" <> $1`},
		{"!=", `"x" <> $1`},
		{">", `"x" > $1`},
		{">=", `"x" >= $1`},
		{"<", `"x" < $1`},
		{"<=", `"x" <= $1`},
		{"like", `"x" like $1`},
		{"notLike", `"x" not like $1`},
		{"isNull", `"x" is null`},
		{"isNotNull", `"x" is not null`},
	}

	for _, tt := range tests {
		t.Run("op_"+tt.op, func(t *testing.T) {
			builder := vexnor.NewSqlBuilder("postgresql")
			query := &vexnor.QueryDefinition{
				Template: vexnor.TemplateNodes{
					&vexnor.FilterNode{
						Param:   "filterBy",
						Columns: makeColumns("x", `"x"`),
					},
				},
			}

			filter := []any{map[string]any{"x": []any{tt.op, "val"}}}
			result, err := builder.Build(query, map[string]any{"filterBy": filter})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.Text != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, result.Text)
			}
		})
	}
}

func TestWriteOp_Between(t *testing.T) {
	t.Run("between with 2 args", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.FilterNode{
					Param:   "filterBy",
					Columns: makeColumns("age", `"age"`),
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"filterBy": []any{map[string]any{"age": []any{"between", 18, 65}}},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != `"age" between $1 and $2` {
			t.Errorf("expected between clause, got %q", result.Text)
		}
	})
}

func TestWriteOp_InWithFlatArgs(t *testing.T) {
	t.Run("in operator with flat args (not nested)", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.FilterNode{
					Param:   "filterBy",
					Columns: makeColumns("status", `"status"`),
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"filterBy": []any{
				map[string]any{"status": []any{"in", "active", "pending"}},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != `"status" in ($1, $2)` {
			t.Errorf("expected in clause, got %q", result.Text)
		}
	})
}

func TestWriteOp_NotInWithFlatArgs(t *testing.T) {
	t.Run("notIn operator with flat args", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.FilterNode{
					Param:   "filterBy",
					Columns: makeColumns("status", `"status"`),
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"filterBy": []any{
				map[string]any{"status": []any{"notIn", "deleted", "banned"}},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != `"status" not in ($1, $2)` {
			t.Errorf("expected not in clause, got %q", result.Text)
		}
	})
}
