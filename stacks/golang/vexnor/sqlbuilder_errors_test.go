package vexnor_test

import (
	"strings"
	"testing"

	"github.com/vexnor-dev/vexnor-go/vexnor"
)

func makeColumns(pairs ...string) *vexnor.OrderedMap {
	om := vexnor.NewOrderedMap()
	for i := 0; i < len(pairs); i += 2 {
		om.Set(pairs[i], pairs[i+1])
	}
	return om
}

func TestFormatParam_SqliteDialect(t *testing.T) {
	t.Run("sqlite uses ? placeholder", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("sqlite")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.TextNode{Value: "SELECT * FROM t WHERE id = "},
				&vexnor.ParamNode{Name: "id"},
				&vexnor.TextNode{Value: " AND name = "},
				&vexnor.ParamNode{Name: "name"},
			},
		}

		result, err := builder.Build(query, map[string]any{"id": 1, "name": "test"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != "SELECT * FROM t WHERE id = ? AND name = ?" {
			t.Errorf("expected ? placeholders, got %q", result.Text)
		}
	})
}

func TestFormatParam_TransactSqlDialect(t *testing.T) {
	t.Run("transactsql uses @param_N placeholder", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("transactsql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.TextNode{Value: "SELECT * FROM t WHERE id = "},
				&vexnor.ParamNode{Name: "id"},
			},
		}

		result, err := builder.Build(query, map[string]any{"id": 42})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != "SELECT * FROM t WHERE id = @param_0" {
			t.Errorf("expected @param_0, got %q", result.Text)
		}
	})
}

func TestWriteOp_InWithNestedArray(t *testing.T) {
	t.Run("in operator with nested array", func(t *testing.T) {
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
				map[string]any{"status": []any{"in", []any{"active", "pending"}}},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !strings.Contains(result.Text, `"status" in ($1, $2)`) {
			t.Errorf("expected in clause with nested array expansion, got %q", result.Text)
		}
		if len(result.Values) != 2 {
			t.Fatalf("expected 2 values, got %d", len(result.Values))
		}
	})
}

func TestWriteOp_InWithEmptyList(t *testing.T) {
	t.Run("in operator with empty list emits 1=0", func(t *testing.T) {
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
				map[string]any{"status": []any{"in", []any{}}},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != "1=0" {
			t.Errorf("expected '1=0' for empty in, got %q", result.Text)
		}
	})
}

func TestWriteOp_NotInWithNestedArray(t *testing.T) {
	t.Run("notIn operator with nested array", func(t *testing.T) {
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
				map[string]any{"status": []any{"notIn", []any{"deleted", "banned"}}},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !strings.Contains(result.Text, `"status" not in ($1, $2)`) {
			t.Errorf("expected not in clause, got %q", result.Text)
		}
	})
}

func TestWriteOp_NotInWithEmptyList(t *testing.T) {
	t.Run("notIn operator with empty list emits nothing", func(t *testing.T) {
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
				map[string]any{"status": []any{"notIn", []any{}}},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != "" {
			t.Errorf("expected empty text for empty notIn, got %q", result.Text)
		}
	})
}

func TestWriteOp_InvalidOperator(t *testing.T) {
	t.Run("invalid filter operator returns error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.FilterNode{
					Param:   "filterBy",
					Columns: makeColumns("status", `"status"`),
				},
			},
		}

		_, err := builder.Build(query, map[string]any{
			"filterBy": []any{
				map[string]any{"status": []any{"badOp", "value"}},
			},
		})
		if err == nil {
			t.Fatal("expected error for invalid operator")
		}
		if !strings.Contains(err.Error(), "Invalid filter operator") {
			t.Errorf("expected 'Invalid filter operator' message, got %q", err.Error())
		}
	})
}

func TestWriteOp_BetweenInsufficientArgs(t *testing.T) {
	t.Run("between with insufficient args returns error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.FilterNode{
					Param:   "filterBy",
					Columns: makeColumns("age", `"age"`),
				},
			},
		}

		_, err := builder.Build(query, map[string]any{
			"filterBy": []any{
				map[string]any{"age": []any{"between", 10}},
			},
		})
		if err == nil {
			t.Fatal("expected error for between with 1 arg")
		}
		if !strings.Contains(err.Error(), "'between' operator requires 2 arguments") {
			t.Errorf("expected between error, got %q", err.Error())
		}
	})
}

func TestBuildOrderBy_InvalidField(t *testing.T) {
	t.Run("invalid orderBy field returns error via OrderedDict", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.OrderByNode{
					Param:   "orderBy",
					Columns: makeColumns("name", `"name"`, "age", `"age"`),
				},
			},
		}

		od := vexnor.NewOrderedDict()
		od.Set("badField", "ASC")

		_, err := builder.Build(query, map[string]any{
			"orderBy": od,
		})
		if err == nil {
			t.Fatal("expected error for invalid orderBy field")
		}
		if !strings.Contains(err.Error(), "Invalid orderBy field") {
			t.Errorf("expected 'Invalid orderBy field' message, got %q", err.Error())
		}
	})
}

func TestBuildOrderBy_InvalidDirection(t *testing.T) {
	t.Run("invalid orderBy direction returns error", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.OrderByNode{
					Param:   "orderBy",
					Columns: makeColumns("name", `"name"`),
				},
			},
		}

		od := vexnor.NewOrderedDict()
		od.Set("name", "SIDEWAYS")

		_, err := builder.Build(query, map[string]any{
			"orderBy": od,
		})
		if err == nil {
			t.Fatal("expected error for invalid direction")
		}
		if !strings.Contains(err.Error(), "Invalid orderBy direction") {
			t.Errorf("expected 'Invalid orderBy direction' message, got %q", err.Error())
		}
	})
}

func TestBuildOrderBy_WithOrderedDict(t *testing.T) {
	t.Run("orderBy with OrderedDict preserves order", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.OrderByNode{
					Param:   "orderBy",
					Columns: makeColumns("name", `"name"`, "age", `"age"`),
				},
			},
		}

		od := vexnor.NewOrderedDict()
		od.Set("age", "DESC")
		od.Set("name", "ASC")

		result, err := builder.Build(query, map[string]any{
			"orderBy": od,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != `order by "age" DESC, "name" ASC` {
			t.Errorf("expected ordered output, got %q", result.Text)
		}
	})
}

func TestBuildOrderBy_EmptyOrderedDict(t *testing.T) {
	t.Run("orderBy with empty OrderedDict emits nothing", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.OrderByNode{
					Param:   "orderBy",
					Columns: makeColumns("name", `"name"`),
				},
			},
		}

		od := vexnor.NewOrderedDict()
		result, err := builder.Build(query, map[string]any{
			"orderBy": od,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != "" {
			t.Errorf("expected empty text for empty dict, got %q", result.Text)
		}
	})
}

func TestBuildOrderBy_NilParam(t *testing.T) {
	t.Run("orderBy with nil param emits nothing", func(t *testing.T) {
		builder := vexnor.NewSqlBuilder("postgresql")
		query := &vexnor.QueryDefinition{
			Template: vexnor.TemplateNodes{
				&vexnor.OrderByNode{
					Param:   "orderBy",
					Columns: makeColumns("name", `"name"`),
				},
			},
		}

		result, err := builder.Build(query, map[string]any{
			"orderBy": nil,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Text != "" {
			t.Errorf("expected empty text, got %q", result.Text)
		}
	})
}
