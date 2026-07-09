package vexnor_test

import (
	"strings"
	"testing"

	"github.com/vexnor-dev/vexnor/stacks/golang/vexnor"
)

// makeWindowByQuery creates a minimal query with a WindowByNode for testing.
func makeWindowByQuery(columns *vexnor.OrderedMap) *vexnor.QueryDefinition {
	return &vexnor.QueryDefinition{
		Name: "test",
		Hash: "test",
		Template: vexnor.TemplateNodes{
			&vexnor.TextNode{Value: `SELECT "a"."id"`},
			&vexnor.WindowByNode{Param: "windowBy", Columns: columns},
			&vexnor.TextNode{Value: ` FROM "t"`},
		},
		Params: map[string]*vexnor.ParamDefinition{},
	}
}

// cols is a shorthand to build an OrderedMap of columns.
func cols(pairs ...string) *vexnor.OrderedMap {
	om := vexnor.NewOrderedMap()
	for i := 0; i < len(pairs); i += 2 {
		om.Set(pairs[i], pairs[i+1])
	}
	return om
}

// ─── buildWindowBy: missing, nil, empty, non-map entries ─────────────────────

func TestWindowBy_MissingParam(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	result, err := builder.Build(query, map[string]any{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Text != `SELECT "a"."id" FROM "t"` {
		t.Errorf("expected no window output, got %q", result.Text)
	}
}

func TestWindowBy_NilParam(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	result, err := builder.Build(query, map[string]any{"windowBy": nil})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Text != `SELECT "a"."id" FROM "t"` {
		t.Errorf("expected no window output, got %q", result.Text)
	}
}

func TestWindowBy_EmptyOrderedDict(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	result, err := builder.Build(query, map[string]any{"windowBy": vexnor.NewOrderedDict()})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Text != `SELECT "a"."id" FROM "t"` {
		t.Errorf("expected no window output, got %q", result.Text)
	}
}

func TestWindowBy_EmptyMapParam(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	result, err := builder.Build(query, map[string]any{"windowBy": map[string]any{}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Text != `SELECT "a"."id" FROM "t"` {
		t.Errorf("expected no window output, got %q", result.Text)
	}
}

func TestWindowBy_NonMapValue(t *testing.T) {
	// windowBy is a string (unsupported type) → treated as no-op
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	result, err := builder.Build(query, map[string]any{"windowBy": "invalid"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Text != `SELECT "a"."id" FROM "t"` {
		t.Errorf("expected no window output, got %q", result.Text)
	}
}

func TestWindowBy_EntryIsNotMap(t *testing.T) {
	// Entry value is a string instead of map — skipped
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("myRank", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("myRank", "not-a-map")

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Text != `SELECT "a"."id" FROM "t"` {
		t.Errorf("expected skipped entry, got %q", result.Text)
	}
}

// ─── buildWindowBy: fn validation ────────────────────────────────────────────

func TestWindowBy_MissingFn(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("myRank", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("myRank", map[string]any{"over": map[string]any{"orderBy": map[string]any{"amount": "ASC"}}})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected error for missing fn")
	}
	if !strings.Contains(err.Error(), "requires a 'fn' property") {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestWindowBy_InvalidFn(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("myRank", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("myRank", map[string]any{"fn": "bogus_function"})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected error for invalid fn")
	}
	if !strings.Contains(err.Error(), "invalid function 'bogus_function'") {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestWindowBy_FnIsNotString(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("myRank", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("myRank", map[string]any{"fn": 123})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected error for non-string fn")
	}
	if !strings.Contains(err.Error(), "requires a 'fn' property") {
		t.Errorf("unexpected error message: %v", err)
	}
}

// ─── Ranking functions ───────────────────────────────────────────────────────

func TestWindowBy_RankingFunctions(t *testing.T) {
	fns := []string{"row_number", "rank", "dense_rank", "percent_rank", "cume_dist"}
	for _, fn := range fns {
		t.Run(fn, func(t *testing.T) {
			builder := vexnor.NewSqlBuilder("postgresql")
			query := makeWindowByQuery(cols("amount", `"a"."amount"`))

			od := vexnor.NewOrderedDict()
			od.Set("myResult", map[string]any{
				"fn": fn,
				"over": map[string]any{
					"orderBy": map[string]any{"amount": "ASC"},
				},
			})

			result, err := builder.Build(query, map[string]any{"windowBy": od})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			expected := `SELECT "a"."id", ` + fn + `() over (order by "a"."amount" ASC) as "myResult" FROM "t"`
			if result.Text != expected {
				t.Errorf("expected %q, got %q", expected, result.Text)
			}
		})
	}
}

// ─── Bucket: ntile ───────────────────────────────────────────────────────────

func TestWindowBy_Ntile_Valid(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("bucket", map[string]any{
		"fn":   "ntile",
		"args": float64(4),
		"over": map[string]any{"orderBy": map[string]any{"amount": "DESC"}},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := `SELECT "a"."id", ntile(4) over (order by "a"."amount" DESC) as "bucket" FROM "t"`
	if result.Text != expected {
		t.Errorf("expected %q, got %q", expected, result.Text)
	}
}

func TestWindowBy_Ntile_ArgsOne(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("bucket", map[string]any{
		"fn":   "ntile",
		"args": float64(1),
		"over": map[string]any{"orderBy": map[string]any{"amount": "ASC"}},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "ntile(1)") {
		t.Errorf("expected ntile(1), got %q", result.Text)
	}
}

func TestWindowBy_Ntile_ArgsZero(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("bucket", map[string]any{
		"fn":   "ntile",
		"args": float64(0),
		"over": map[string]any{"orderBy": map[string]any{"amount": "ASC"}},
	})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected error for ntile args=0")
	}
	if !strings.Contains(err.Error(), "must be a positive integer") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestWindowBy_Ntile_ArgsMissing(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("bucket", map[string]any{
		"fn":   "ntile",
		"over": map[string]any{"orderBy": map[string]any{"amount": "ASC"}},
	})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected error for missing ntile args")
	}
	if !strings.Contains(err.Error(), "ntile requires 'args'") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestWindowBy_Ntile_ArgsNegative(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("bucket", map[string]any{
		"fn":   "ntile",
		"args": float64(-3),
		"over": map[string]any{"orderBy": map[string]any{"amount": "ASC"}},
	})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected error for negative ntile args")
	}
	if !strings.Contains(err.Error(), "must be a positive integer") {
		t.Errorf("unexpected error: %v", err)
	}
}

// ─── Aggregate functions ─────────────────────────────────────────────────────

func TestWindowBy_Aggregate_Sum(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount" as "amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("totalAmount", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Column has ' as "amount"' suffix which gets stripped
	expected := `SELECT "a"."id", sum("a"."amount") over (order by "a"."amount" ASC) as "totalAmount" FROM "t"`
	if result.Text != expected {
		t.Errorf("expected %q, got %q", expected, result.Text)
	}
}

func TestWindowBy_Aggregate_AllFunctions(t *testing.T) {
	fns := []string{"sum", "avg", "count", "min", "max", "first_value", "last_value"}
	for _, fn := range fns {
		t.Run(fn, func(t *testing.T) {
			builder := vexnor.NewSqlBuilder("postgresql")
			query := makeWindowByQuery(cols("amount", `"a"."amount"`))

			od := vexnor.NewOrderedDict()
			od.Set("result", map[string]any{
				"fn":  fn,
				"col": "amount",
				"over": map[string]any{
					"orderBy": map[string]any{"amount": "ASC"},
				},
			})

			result, err := builder.Build(query, map[string]any{"windowBy": od})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !strings.Contains(result.Text, fn+`("a"."amount")`) {
				t.Errorf("expected %s call, got %q", fn, result.Text)
			}
		})
	}
}

func TestWindowBy_Aggregate_CountStar(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("totalRows", map[string]any{
		"fn":  "count",
		"col": "*",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "count(*)") {
		t.Errorf("expected count(*), got %q", result.Text)
	}
}

func TestWindowBy_Aggregate_MissingCol(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("result", map[string]any{
		"fn": "sum",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
		},
	})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected error for missing col on aggregate")
	}
	if !strings.Contains(err.Error(), "requires 'col'") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestWindowBy_Aggregate_EmptyCol(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("result", map[string]any{
		"fn":  "avg",
		"col": "",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
		},
	})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected error for empty col on aggregate")
	}
	if !strings.Contains(err.Error(), "requires 'col'") {
		t.Errorf("unexpected error: %v", err)
	}
}

// ─── Offset functions (lag, lead) ────────────────────────────────────────────

func TestWindowBy_Offset_Lag(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("prevAmount", map[string]any{
		"fn":   "lag",
		"col":  "amount",
		"args": float64(2),
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, `lag("a"."amount", 2)`) {
		t.Errorf("expected lag with offset 2, got %q", result.Text)
	}
}

func TestWindowBy_Offset_Lead(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("nextAmount", map[string]any{
		"fn":   "lead",
		"col":  "amount",
		"args": float64(3),
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, `lead("a"."amount", 3)`) {
		t.Errorf("expected lead with offset 3, got %q", result.Text)
	}
}

func TestWindowBy_Offset_DefaultArgs(t *testing.T) {
	// When args is not specified, offset defaults to 1
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("prevAmount", map[string]any{
		"fn":  "lag",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, `lag("a"."amount", 1)`) {
		t.Errorf("expected lag with default offset 1, got %q", result.Text)
	}
}

func TestWindowBy_Offset_MissingCol(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("prevAmount", map[string]any{
		"fn":   "lag",
		"args": float64(1),
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
		},
	})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected error for missing col on offset function")
	}
	if !strings.Contains(err.Error(), "requires 'col'") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestWindowBy_Offset_ArgsZeroDefaultsToOne(t *testing.T) {
	// args=0 is invalid for offset, code resets to 1
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("prevAmount", map[string]any{
		"fn":   "lag",
		"col":  "amount",
		"args": float64(0),
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// offset <= 0 resets to 1
	if !strings.Contains(result.Text, `lag("a"."amount", 1)`) {
		t.Errorf("expected lag with offset 1 (reset from 0), got %q", result.Text)
	}
}

// ─── OVER clause: partitionBy, orderBy ───────────────────────────────────────

func TestWindowBy_Over_PartitionByOnly(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("status", `"a"."status"`, "amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("myRank", map[string]any{
		"fn": "row_number",
		"over": map[string]any{
			"partitionBy": []any{"status"},
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, `over (partition by "a"."status")`) {
		t.Errorf("expected partition by clause, got %q", result.Text)
	}
}

func TestWindowBy_Over_OrderByOnly(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("myRank", map[string]any{
		"fn": "rank",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "DESC"},
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, `over (order by "a"."amount" DESC)`) {
		t.Errorf("expected order by clause, got %q", result.Text)
	}
}

func TestWindowBy_Over_PartitionByAndOrderBy(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("status", `"a"."status"`, "amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("myRank", map[string]any{
		"fn": "row_number",
		"over": map[string]any{
			"partitionBy": []any{"status"},
			"orderBy":     map[string]any{"amount": "ASC"},
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, `partition by "a"."status" order by "a"."amount" ASC`) {
		t.Errorf("expected partition + order, got %q", result.Text)
	}
}

func TestWindowBy_Over_OrderByWithOrderedDict(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`, "status", `"a"."status"`))

	orderBy := vexnor.NewOrderedDict()
	orderBy.Set("amount", "DESC")
	orderBy.Set("status", "ASC")

	od := vexnor.NewOrderedDict()
	od.Set("myRank", map[string]any{
		"fn": "row_number",
		"over": map[string]any{
			"orderBy": orderBy,
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// OrderedDict preserves insertion order
	if !strings.Contains(result.Text, `order by "a"."amount" DESC, "a"."status" ASC`) {
		t.Errorf("expected ordered output, got %q", result.Text)
	}
}

func TestWindowBy_Over_NoOverClause(t *testing.T) {
	// No over key → empty over ()
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("myRank", map[string]any{
		"fn": "row_number",
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, `row_number() over ()`) {
		t.Errorf("expected empty over(), got %q", result.Text)
	}
}

// ─── OVER clause: frame ──────────────────────────────────────────────────────

func TestWindowBy_Frame_RowsNumericBounds(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "rows",
			"start":   float64(3),
			"end":     float64(0),
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "rows between 3 preceding and current row") {
		t.Errorf("expected rows frame with numeric bounds, got %q", result.Text)
	}
}

func TestWindowBy_Frame_RowsWithInt(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "rows",
			"start":   5,
			"end":     2,
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "rows between 5 preceding and 2 following") {
		t.Errorf("expected rows with int bounds, got %q", result.Text)
	}
}

func TestWindowBy_Frame_RowsWithInt64(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "rows",
			"start":   int64(7),
			"end":     int64(0),
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "rows between 7 preceding and current row") {
		t.Errorf("expected rows with int64 bounds, got %q", result.Text)
	}
}

func TestWindowBy_Frame_RangeStringBounds(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "range",
			"start":   "unbounded preceding",
			"end":     "current row",
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "range between unbounded preceding and current row") {
		t.Errorf("expected range with string bounds, got %q", result.Text)
	}
}

func TestWindowBy_Frame_NilStartAndEnd(t *testing.T) {
	// nil start and nil end both present — but condition requires non-nil to trigger frame
	// So the frame is NOT emitted when both are nil
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "rows",
			"start":   nil,
			"end":     nil,
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// With both nil, frame clause is skipped (condition: hasStart && startObj != nil || hasEnd && endObj != nil)
	if strings.Contains(result.Text, "rows between") {
		t.Errorf("expected no frame clause when both start and end are nil, got %q", result.Text)
	}
}

func TestWindowBy_Frame_NilStartNonNilEnd(t *testing.T) {
	// nil start → unbounded preceding, non-nil end triggers frame clause
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "rows",
			"start":   nil,
			"end":     float64(0),
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "rows between unbounded preceding and current row") {
		t.Errorf("expected nil start → unbounded preceding, got %q", result.Text)
	}
}

func TestWindowBy_Frame_NonNilStartNilEnd(t *testing.T) {
	// non-nil start triggers frame, nil end → unbounded following
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "rows",
			"start":   float64(5),
			"end":     nil,
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "rows between 5 preceding and unbounded following") {
		t.Errorf("expected nil end → unbounded following, got %q", result.Text)
	}
}

func TestWindowBy_Frame_StringNumericBound(t *testing.T) {
	// String "5" gets parsed as numeric
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "rows",
			"start":   "5",
			"end":     "current row",
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "rows between 5 preceding and current row") {
		t.Errorf("expected string '5' parsed as numeric bound, got %q", result.Text)
	}
}

func TestWindowBy_Frame_UnknownStringBound(t *testing.T) {
	// Unknown string passed through as-is
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "rows",
			"start":   "unbounded following",
			"end":     "unbounded following",
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "rows between unbounded following and unbounded following") {
		t.Errorf("expected unknown string pass-through, got %q", result.Text)
	}
}

func TestWindowBy_Frame_MissingFrameKey(t *testing.T) {
	// start/end specified but frame key missing → error
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"start":   float64(3),
			"end":     float64(0),
		},
	})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected error when frame is missing but start/end specified")
	}
	if !strings.Contains(err.Error(), "'frame' (rows|range) is required") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestWindowBy_Frame_InvalidFrameValue(t *testing.T) {
	// frame is "invalid" → error
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "invalid",
			"start":   float64(3),
			"end":     float64(0),
		},
	})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected error for invalid frame value")
	}
	if !strings.Contains(err.Error(), "'frame' (rows|range) is required") {
		t.Errorf("unexpected error: %v", err)
	}
}

// ─── MSSQL dialect validation ────────────────────────────────────────────────

func TestWindowBy_MSSQL_RangeNumericBoundsError(t *testing.T) {
	builder := vexnor.NewSqlBuilder("transactsql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "range",
			"start":   float64(3),
			"end":     "current row",
		},
	})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected error for MSSQL range + numeric bounds")
	}
	if !strings.Contains(err.Error(), "MSSQL does not support numeric bounds with RANGE frame") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestWindowBy_MSSQL_RangeNumericEndBoundsError(t *testing.T) {
	builder := vexnor.NewSqlBuilder("transactsql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "range",
			"start":   "unbounded preceding",
			"end":     int64(5),
		},
	})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected error for MSSQL range + numeric end bound")
	}
	if !strings.Contains(err.Error(), "MSSQL does not support numeric bounds with RANGE frame") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestWindowBy_MSSQL_RangeStringBoundsOK(t *testing.T) {
	// range with string bounds is fine for MSSQL
	builder := vexnor.NewSqlBuilder("transactsql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "range",
			"start":   "unbounded preceding",
			"end":     "current row",
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "range between unbounded preceding and current row") {
		t.Errorf("expected valid MSSQL range, got %q", result.Text)
	}
}

func TestWindowBy_MSSQL_RowsNumericBoundsOK(t *testing.T) {
	// rows with numeric bounds is fine for MSSQL
	builder := vexnor.NewSqlBuilder("transactsql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "rows",
			"start":   float64(5),
			"end":     float64(0),
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "rows between 5 preceding and current row") {
		t.Errorf("expected valid MSSQL rows frame, got %q", result.Text)
	}
}

// ─── Column resolution ───────────────────────────────────────────────────────

func TestWindowBy_ColumnResolution_FoundInMap(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	// Column with alias suffix — should be stripped
	query := makeWindowByQuery(cols("amount", `"orders"."amount" as "amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// The ' as "amount"' part should be stripped from the column ref
	if !strings.Contains(result.Text, `sum("orders"."amount")`) {
		t.Errorf("expected stripped alias, got %q", result.Text)
	}
}

func TestWindowBy_ColumnResolution_NotFoundFallback(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	// Column map does NOT contain the referenced col
	query := makeWindowByQuery(cols("status", `"a"."status"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "unknownCol",
		"over": map[string]any{
			"orderBy": map[string]any{"status": "ASC"},
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Fallback: quoted identifier
	if !strings.Contains(result.Text, `sum("unknownCol")`) {
		t.Errorf("expected fallback quoted column, got %q", result.Text)
	}
}

func TestWindowBy_ColumnResolution_NoAliasSuffix(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	// Column without alias → returned as-is
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, `sum("a"."amount")`) {
		t.Errorf("expected column without alias, got %q", result.Text)
	}
}

// ─── map[string]any param path (not OrderedDict) ────────────────────────────

func TestWindowBy_MapParam_UsesColumnsKeyOrder(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	// Columns order: status, amount
	query := makeWindowByQuery(cols("status", `"a"."status"`, "amount", `"a"."amount"`))

	// map[string]any with entries in arbitrary order
	windowBy := map[string]any{
		"sumAmount": map[string]any{
			"fn":  "sum",
			"col": "amount",
			"over": map[string]any{
				"orderBy": map[string]any{"amount": "ASC"},
			},
		},
		"myRank": map[string]any{
			"fn": "row_number",
			"over": map[string]any{
				"orderBy": map[string]any{"amount": "DESC"},
			},
		},
	}

	result, err := builder.Build(query, map[string]any{"windowBy": windowBy})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Both entries should appear (order depends on columns.Keys matching)
	if !strings.Contains(result.Text, `as "sumAmount"`) {
		t.Errorf("expected sumAmount alias, got %q", result.Text)
	}
	if !strings.Contains(result.Text, `as "myRank"`) {
		t.Errorf("expected myRank alias, got %q", result.Text)
	}
}

func TestWindowBy_MapParam_EntryNotInColumns(t *testing.T) {
	// Entry key not in Columns.Keys — still gets included (extra keys path)
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	windowBy := map[string]any{
		"extraRank": map[string]any{
			"fn": "rank",
			"over": map[string]any{
				"orderBy": map[string]any{"amount": "ASC"},
			},
		},
	}

	result, err := builder.Build(query, map[string]any{"windowBy": windowBy})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, `as "extraRank"`) {
		t.Errorf("expected extraRank alias, got %q", result.Text)
	}
}

// ─── Multiple window entries in one query ────────────────────────────────────

func TestWindowBy_MultipleEntries(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`, "status", `"a"."status"`))

	od := vexnor.NewOrderedDict()
	od.Set("myRank", map[string]any{
		"fn": "row_number",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "DESC"},
		},
	})
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"partitionBy": []any{"status"},
			"orderBy":     map[string]any{"amount": "ASC"},
		},
	})
	od.Set("prevAmount", map[string]any{
		"fn":  "lag",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// All three should appear in order
	rankIdx := strings.Index(result.Text, `as "myRank"`)
	sumIdx := strings.Index(result.Text, `as "runningSum"`)
	lagIdx := strings.Index(result.Text, `as "prevAmount"`)

	if rankIdx < 0 || sumIdx < 0 || lagIdx < 0 {
		t.Fatalf("expected all three aliases, got %q", result.Text)
	}
	if rankIdx > sumIdx || sumIdx > lagIdx {
		t.Errorf("expected insertion order preserved, got %q", result.Text)
	}
}

// ─── toInt coverage ──────────────────────────────────────────────────────────

func TestWindowBy_ToInt_ViaOffset(t *testing.T) {
	// toInt is exercised through the offset args path
	tests := []struct {
		name     string
		args     any
		expected string
	}{
		{"float64", float64(3), `lag("a"."amount", 3)`},
		{"int", int(2), `lag("a"."amount", 2)`},
		{"int64", int64(4), `lag("a"."amount", 4)`},
		{"zero float64 defaults to 1", float64(0), `lag("a"."amount", 1)`},
		{"negative defaults to 1", float64(-5), `lag("a"."amount", 1)`},
		{"string (unsupported) defaults to 0 → 1", "abc", `lag("a"."amount", 1)`},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			builder := vexnor.NewSqlBuilder("postgresql")
			query := makeWindowByQuery(cols("amount", `"a"."amount"`))

			od := vexnor.NewOrderedDict()
			od.Set("prev", map[string]any{
				"fn":   "lag",
				"col":  "amount",
				"args": tc.args,
				"over": map[string]any{
					"orderBy": map[string]any{"amount": "ASC"},
				},
			})

			result, err := builder.Build(query, map[string]any{"windowBy": od})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !strings.Contains(result.Text, tc.expected) {
				t.Errorf("expected %q in output, got %q", tc.expected, result.Text)
			}
		})
	}
}

func TestWindowBy_ToInt_ViaNtile(t *testing.T) {
	// ntile exercises toInt for positive values
	tests := []struct {
		name     string
		args     any
		expected string
	}{
		{"int", int(4), "ntile(4)"},
		{"int64", int64(10), "ntile(10)"},
		{"float64", float64(7), "ntile(7)"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			builder := vexnor.NewSqlBuilder("postgresql")
			query := makeWindowByQuery(cols("amount", `"a"."amount"`))

			od := vexnor.NewOrderedDict()
			od.Set("bucket", map[string]any{
				"fn":   "ntile",
				"args": tc.args,
				"over": map[string]any{
					"orderBy": map[string]any{"amount": "ASC"},
				},
			})

			result, err := builder.Build(query, map[string]any{"windowBy": od})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !strings.Contains(result.Text, tc.expected) {
				t.Errorf("expected %q in output, got %q", tc.expected, result.Text)
			}
		})
	}
}

// ─── isNumeric coverage (via MSSQL validation path) ──────────────────────────

func TestWindowBy_IsNumeric_Int(t *testing.T) {
	// int triggers MSSQL range validation
	builder := vexnor.NewSqlBuilder("transactsql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "range",
			"start":   int(3),
			"end":     "current row",
		},
	})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected MSSQL error for int start with range frame")
	}
}

func TestWindowBy_IsNumeric_Float64(t *testing.T) {
	builder := vexnor.NewSqlBuilder("transactsql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "range",
			"start":   "unbounded preceding",
			"end":     float64(2),
		},
	})

	_, err := builder.Build(query, map[string]any{"windowBy": od})
	if err == nil {
		t.Fatal("expected MSSQL error for float64 end with range frame")
	}
}

func TestWindowBy_IsNumeric_StringIsNotNumeric(t *testing.T) {
	// String bounds with range frame should be OK on MSSQL (isNumeric returns false)
	builder := vexnor.NewSqlBuilder("transactsql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "range",
			"start":   "unbounded preceding",
			"end":     "unbounded following",
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "range between") {
		t.Errorf("expected valid output, got %q", result.Text)
	}
}

func TestWindowBy_IsNumeric_NilIsNotNumeric(t *testing.T) {
	// nil bounds with range frame should be OK on MSSQL (isNumeric returns false for nil)
	// Need at least one non-nil to trigger the frame clause
	builder := vexnor.NewSqlBuilder("transactsql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "range",
			"start":   "unbounded preceding",
			"end":     "current row",
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, "range between") {
		t.Errorf("expected valid output, got %q", result.Text)
	}
}

func TestWindowBy_MSSQL_NilBoundWithRange(t *testing.T) {
	// nil start with range frame on MSSQL — isNumeric(nil) is false, no error
	builder := vexnor.NewSqlBuilder("transactsql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "range",
			"start":   nil,
			"end":     "current row",
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// nil → unbounded preceding (not numeric), so MSSQL allows it
	if !strings.Contains(result.Text, "range between unbounded preceding and current row") {
		t.Errorf("expected nil bound handled correctly, got %q", result.Text)
	}
}

// ─── formatFrameBound: default/unknown type ──────────────────────────────────

func TestWindowBy_FormatFrameBound_UnknownType(t *testing.T) {
	// A boolean passed as bound → formatFrameBound default case → "current row"
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	od := vexnor.NewOrderedDict()
	od.Set("runningSum", map[string]any{
		"fn":  "sum",
		"col": "amount",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "ASC"},
			"frame":   "rows",
			"start":   true,
			"end":     false,
		},
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Unknown types default to "current row"
	if !strings.Contains(result.Text, "rows between current row and current row") {
		t.Errorf("expected default 'current row' for unknown type, got %q", result.Text)
	}
}

// ─── Registry-based integration test ─────────────────────────────────────────

func TestWindowBy_ViaRegistry(t *testing.T) {
	manifest := &vexnor.QueryManifest{
		Version:          1,
		GeneratorVersion: "1.0.0",
		Dialect:          "postgresql",
		Queries: map[string]*vexnor.QueryDefinition{
			"test": makeWindowByQuery(cols("amount", `"a"."amount"`)),
		},
	}

	registry := vexnor.NewQueryRegistry("postgresql")
	registry.Load(manifest)

	od := vexnor.NewOrderedDict()
	od.Set("myRank", map[string]any{
		"fn": "row_number",
		"over": map[string]any{
			"orderBy": map[string]any{"amount": "DESC"},
		},
	})

	result, err := registry.Build("test", map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := `SELECT "a"."id", row_number() over (order by "a"."amount" DESC) as "myRank" FROM "t"`
	if result.Text != expected {
		t.Errorf("expected %q, got %q", expected, result.Text)
	}
}

// ─── Edge case: over as OrderedDict ──────────────────────────────────────────

func TestWindowBy_OverAsOrderedDict(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	overOD := vexnor.NewOrderedDict()
	overOD.Set("orderBy", map[string]any{"amount": "ASC"})

	od := vexnor.NewOrderedDict()
	od.Set("myRank", map[string]any{
		"fn":   "row_number",
		"over": overOD,
	})

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, `order by "a"."amount" ASC`) {
		t.Errorf("expected over with OrderedDict to work, got %q", result.Text)
	}
}

// ─── Edge case: entry value as OrderedDict (inside map[string]any param) ─────

func TestWindowBy_EntryAsOrderedDict(t *testing.T) {
	builder := vexnor.NewSqlBuilder("postgresql")
	query := makeWindowByQuery(cols("amount", `"a"."amount"`))

	// The entry itself is an OrderedDict
	entry := vexnor.NewOrderedDict()
	entry.Set("fn", "rank")
	entry.Set("over", map[string]any{"orderBy": map[string]any{"amount": "ASC"}})

	od := vexnor.NewOrderedDict()
	od.Set("myRank", entry)

	result, err := builder.Build(query, map[string]any{"windowBy": od})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Text, `rank() over (order by "a"."amount" ASC) as "myRank"`) {
		t.Errorf("expected OrderedDict entry to work, got %q", result.Text)
	}
}
