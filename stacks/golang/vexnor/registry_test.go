package vexnor_test

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/vexnor-dev/vexnor/stacks/golang/vexnor"
)

func makeTestManifest() *vexnor.QueryManifest {
	manifest := &vexnor.QueryManifest{
		Version:          1,
		GeneratorVersion: "1.0.0",
		Dialect:          "postgresql",
		Queries: map[string]*vexnor.QueryDefinition{
			"hash_select": {
				Name:     "selectAccounts",
				Hash:     "hash_select",
				Location: "src/queries.ts:10",
				Template: vexnor.TemplateNodes{
					&vexnor.TextNode{Value: "SELECT * FROM accounts WHERE status = "},
					&vexnor.ParamNode{Name: "status"},
				},
				Params: map[string]*vexnor.ParamDefinition{
					"status": {Name: "status"},
				},
				Authorization: nil,
			},
			"hash_admin": {
				Name:     "deleteAccount",
				Hash:     "hash_admin",
				Location: "src/queries.ts:20",
				Template: vexnor.TemplateNodes{
					&vexnor.TextNode{Value: "DELETE FROM accounts WHERE account_id = "},
					&vexnor.ParamNode{Name: "accountId"},
				},
				Params: map[string]*vexnor.ParamDefinition{
					"accountId": {Name: "accountId"},
				},
				Authorization: []string{"admin"},
			},
			"hash_ctx": {
				Name:     "myOrders",
				Hash:     "hash_ctx",
				Location: "src/queries.ts:30",
				Template: vexnor.TemplateNodes{
					&vexnor.TextNode{Value: "SELECT * FROM orders WHERE account_id = "},
					&vexnor.ParamNode{Name: "userId"},
				},
				Params: map[string]*vexnor.ParamDefinition{
					"userId": {Name: "userId", IsContext: true},
				},
				Authorization: []string{"user"},
			},
		},
	}
	return manifest
}

func TestRegistry_LoadAndResolve(t *testing.T) {
	t.Run("loads manifest and resolves query by hash", func(t *testing.T) {
		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(makeTestManifest())

		q := reg.GetQuery("hash_select")
		if q == nil {
			t.Fatal("expected to find query by hash")
		}
		if q.Name != "selectAccounts" {
			t.Fatalf("expected name %q, got %q", "selectAccounts", q.Name)
		}
	})

	t.Run("Build produces correct SQL", func(t *testing.T) {
		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(makeTestManifest())

		result, err := reg.Build("hash_select", map[string]any{"status": "active"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		expectedSQL := "SELECT * FROM accounts WHERE status = $1"
		if result.Text != expectedSQL {
			t.Fatalf("expected SQL %q, got %q", expectedSQL, result.Text)
		}
		if len(result.Values) != 1 {
			t.Fatalf("expected 1 value, got %d", len(result.Values))
		}
		if result.Values[0] != "active" {
			t.Fatalf("expected value %q, got %v", "active", result.Values[0])
		}
	})
}

func TestRegistry_Execute_ContextInjection(t *testing.T) {
	t.Run("context param is injected from context map", func(t *testing.T) {
		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(makeTestManifest())

		// Register auth hook to allow execution
		reg.RegisterAuthorization(func(args *vexnor.AuthorizeArgs) error {
			return nil
		})

		var capturedResult *vexnor.SqlBuildResult
		result, err := reg.Execute("hash_ctx", nil, map[string]any{"userId": "user-123"}, func(build *vexnor.SqlBuildResult) (any, error) {
			capturedResult = build
			return []map[string]any{{"orderId": "o1"}}, nil
		})

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result == nil {
			t.Fatal("expected result")
		}
		if capturedResult == nil {
			t.Fatal("execFn was not called")
		}
		if len(capturedResult.Values) != 1 {
			t.Fatalf("expected 1 value, got %d", len(capturedResult.Values))
		}
		if capturedResult.Values[0] != "user-123" {
			t.Fatalf("expected context value %q, got %v", "user-123", capturedResult.Values[0])
		}
	})

	t.Run("fails when required context value is missing", func(t *testing.T) {
		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(makeTestManifest())

		reg.RegisterAuthorization(func(args *vexnor.AuthorizeArgs) error {
			return nil
		})

		_, err := reg.Execute("hash_ctx", nil, map[string]any{}, func(build *vexnor.SqlBuildResult) (any, error) {
			t.Fatal("should not be called")
			return nil, nil
		})

		if err == nil {
			t.Fatal("expected error for missing context value")
		}
		if !errors.Is(err, vexnor.ErrContextMissing) {
			t.Fatalf("expected ErrContextMissing, got %v", err)
		}
	})
}

func TestRegistry_Build_UnknownHash(t *testing.T) {
	t.Run("returns error for unknown hash", func(t *testing.T) {
		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(makeTestManifest())

		_, err := reg.Build("nonexistent", nil)
		if err == nil {
			t.Fatal("expected error for unknown hash")
		}
		if !errors.Is(err, vexnor.ErrUnknownQuery) {
			t.Fatalf("expected ErrUnknownQuery, got %v", err)
		}
	})
}

func TestRegistry_GetAuthorizedQueries(t *testing.T) {
	t.Run("returns only queries with authorization tags", func(t *testing.T) {
		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(makeTestManifest())

		authorized := reg.GetAuthorizedQueries()

		// hash_admin and hash_ctx have authorization tags
		if len(authorized) != 2 {
			t.Fatalf("expected 2 authorized queries, got %d", len(authorized))
		}

		names := make(map[string]bool)
		for _, q := range authorized {
			names[q.Name] = true
		}
		if !names["deleteAccount"] {
			t.Error("expected deleteAccount in authorized queries")
		}
		if !names["myOrders"] {
			t.Error("expected myOrders in authorized queries")
		}
	})
}

func TestRegistry_GetUnauthorizedQueries(t *testing.T) {
	t.Run("returns only queries without authorization tags", func(t *testing.T) {
		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(makeTestManifest())

		unauthorized := reg.GetUnauthorizedQueries()

		// Only hash_select has no authorization tags
		if len(unauthorized) != 1 {
			t.Fatalf("expected 1 unauthorized query, got %d", len(unauthorized))
		}
		if unauthorized[0].Name != "selectAccounts" {
			t.Fatalf("expected selectAccounts, got %q", unauthorized[0].Name)
		}
	})
}

func TestRegistry_CheckAuthorization(t *testing.T) {
	t.Run("fails when no hooks for tagged queries", func(t *testing.T) {
		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(makeTestManifest())

		err := reg.CheckAuthorization()
		if err == nil {
			t.Fatal("expected error for unprotected queries")
		}
		if !errors.Is(err, vexnor.ErrAuthorizationDenied) {
			t.Fatalf("expected ErrAuthorizationDenied, got %v", err)
		}
	})

	t.Run("passes when hook is registered", func(t *testing.T) {
		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(makeTestManifest())

		reg.RegisterAuthorization(func(args *vexnor.AuthorizeArgs) error {
			return nil
		})

		err := reg.CheckAuthorization()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}

func TestRegistry_Validate_Filter(t *testing.T) {
	t.Run("validates columns and operators", func(t *testing.T) {
		manifest := &vexnor.QueryManifest{
			Version:          1,
			GeneratorVersion: "1.0.0",
			Dialect:          "postgresql",
			Queries: map[string]*vexnor.QueryDefinition{
				"hash_filter": {
					Name: "filterQuery",
					Hash: "hash_filter",
					Template: vexnor.TemplateNodes{
						&vexnor.TextNode{Value: "SELECT * FROM accounts"},
					},
					Params: map[string]*vexnor.ParamDefinition{
						"filterBy": {
							Name: "filterBy",
							Validation: &vexnor.ParamValidationSchema{
								Type:      "filter",
								Columns:   []string{"email", "status"},
								Operators: []string{"=", "like", "in"},
							},
						},
					},
				},
			},
		}

		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(manifest)

		// Valid filter
		_, err := reg.Execute("hash_filter", map[string]any{
			"filterBy": []any{
				map[string]any{"email": []any{"like", "%@example.com"}},
			},
		}, nil, func(build *vexnor.SqlBuildResult) (any, error) {
			return nil, nil
		})
		if err != nil {
			t.Fatalf("unexpected error for valid filter: %v", err)
		}

		// Invalid column
		_, err = reg.Execute("hash_filter", map[string]any{
			"filterBy": []any{
				map[string]any{"badColumn": []any{"=", "value"}},
			},
		}, nil, func(build *vexnor.SqlBuildResult) (any, error) {
			return nil, nil
		})
		if err == nil {
			t.Fatal("expected validation error for invalid column")
		}
		if !errors.Is(err, vexnor.ErrValidation) {
			t.Fatalf("expected ErrValidation, got %v", err)
		}

		// Invalid operator
		_, err = reg.Execute("hash_filter", map[string]any{
			"filterBy": []any{
				map[string]any{"email": []any{"between", "a", "z"}},
			},
		}, nil, func(build *vexnor.SqlBuildResult) (any, error) {
			return nil, nil
		})
		if err == nil {
			t.Fatal("expected validation error for invalid operator")
		}
		if !errors.Is(err, vexnor.ErrValidation) {
			t.Fatalf("expected ErrValidation, got %v", err)
		}
	})
}

func TestRegistry_Validate_Projection(t *testing.T) {
	t.Run("validates columns and functions", func(t *testing.T) {
		manifest := &vexnor.QueryManifest{
			Version:          1,
			GeneratorVersion: "1.0.0",
			Dialect:          "postgresql",
			Queries: map[string]*vexnor.QueryDefinition{
				"hash_proj": {
					Name: "projectionQuery",
					Hash: "hash_proj",
					Template: vexnor.TemplateNodes{
						&vexnor.TextNode{Value: "SELECT * FROM accounts"},
					},
					Params: map[string]*vexnor.ParamDefinition{
						"projection": {
							Name: "projection",
							Validation: &vexnor.ParamValidationSchema{
								Type:      "projection",
								Columns:   []string{"email", "status", "createdAt"},
								Functions: []string{"count", "sum"},
							},
						},
					},
				},
			},
		}

		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(manifest)

		// Valid projection — plain column
		_, err := reg.Execute("hash_proj", map[string]any{
			"projection": []any{"email", "status"},
		}, nil, func(build *vexnor.SqlBuildResult) (any, error) {
			return nil, nil
		})
		if err != nil {
			t.Fatalf("unexpected error for valid projection: %v", err)
		}

		// Valid projection — aggregate function
		_, err = reg.Execute("hash_proj", map[string]any{
			"projection": []any{
				[]any{"count", "email", "emailCount"},
			},
		}, nil, func(build *vexnor.SqlBuildResult) (any, error) {
			return nil, nil
		})
		if err != nil {
			t.Fatalf("unexpected error for valid aggregate projection: %v", err)
		}

		// Invalid column
		_, err = reg.Execute("hash_proj", map[string]any{
			"projection": []any{"badColumn"},
		}, nil, func(build *vexnor.SqlBuildResult) (any, error) {
			return nil, nil
		})
		if err == nil {
			t.Fatal("expected validation error for invalid projection column")
		}
		if !errors.Is(err, vexnor.ErrValidation) {
			t.Fatalf("expected ErrValidation, got %v", err)
		}

		// Invalid function
		_, err = reg.Execute("hash_proj", map[string]any{
			"projection": []any{
				[]any{"avg", "email", "emailAvg"},
			},
		}, nil, func(build *vexnor.SqlBuildResult) (any, error) {
			return nil, nil
		})
		if err == nil {
			t.Fatal("expected validation error for invalid aggregate function")
		}
		if !errors.Is(err, vexnor.ErrValidation) {
			t.Fatalf("expected ErrValidation, got %v", err)
		}
	})
}

func TestRegistry_LoadFromJSON(t *testing.T) {
	t.Run("loads from raw JSON and resolves query", func(t *testing.T) {
		jsonData := `{
			"version": 1,
			"generatorVersion": "1.0.0",
			"dialect": "postgresql",
			"queries": {
				"abc123": {
					"name": "testQuery",
					"hash": "abc123",
					"location": "src/test.ts:1",
					"template": [{"type": "text", "value": "SELECT 1"}],
					"params": {},
					"authorization": []
				}
			}
		}`

		manifest, err := vexnor.LoadJSON([]byte(jsonData))
		if err != nil {
			t.Fatalf("failed to load JSON: %v", err)
		}

		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(manifest)

		q := reg.GetQuery("abc123")
		if q == nil {
			t.Fatal("expected to find query")
		}
		if q.Name != "testQuery" {
			t.Fatalf("expected name %q, got %q", "testQuery", q.Name)
		}

		result, err := reg.Build("abc123", nil)
		if err != nil {
			t.Fatalf("unexpected build error: %v", err)
		}
		if result.Text != "SELECT 1" {
			t.Fatalf("expected SQL %q, got %q", "SELECT 1", result.Text)
		}
	})
}

func TestRegistry_GetRegisteredQueries(t *testing.T) {
	t.Run("returns all registered queries", func(t *testing.T) {
		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(makeTestManifest())

		queries := reg.GetRegisteredQueries()
		if len(queries) != 3 {
			t.Fatalf("expected 3 queries, got %d", len(queries))
		}

		hashes := make(map[string]bool)
		for _, q := range queries {
			hashes[q.Hash] = true
		}
		if !hashes["hash_select"] || !hashes["hash_admin"] || !hashes["hash_ctx"] {
			t.Fatalf("missing expected hashes, got: %v", hashes)
		}
	})
}

// Verify JSON round-trip of manifest with template nodes
func TestRegistry_ManifestJSONRoundTrip(t *testing.T) {
	t.Run("manifest serializes and deserializes correctly", func(t *testing.T) {
		original := makeTestManifest()

		data, err := json.Marshal(original)
		if err != nil {
			t.Fatalf("failed to marshal manifest: %v", err)
		}

		loaded, err := vexnor.LoadJSON(data)
		if err != nil {
			t.Fatalf("failed to load marshaled JSON: %v", err)
		}

		if len(loaded.Queries) != len(original.Queries) {
			t.Fatalf("expected %d queries, got %d", len(original.Queries), len(loaded.Queries))
		}

		q := loaded.Queries["hash_select"]
		if q == nil {
			t.Fatal("expected to find hash_select after round-trip")
		}
		if q.Name != "selectAccounts" {
			t.Fatalf("expected name %q, got %q", "selectAccounts", q.Name)
		}
	})
}
