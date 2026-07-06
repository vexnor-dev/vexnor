package vexnor_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/vexnor-dev/vexnor-go/vexnor"
)

func TestRegistry_Use(t *testing.T) {
	t.Run("registers plugin and invokes it during Execute", func(t *testing.T) {
		reg := vexnor.NewQueryRegistry("postgresql")

		manifest := &vexnor.QueryManifest{
			Version:          1,
			GeneratorVersion: "1.0.0",
			Dialect:          "postgresql",
			Queries: map[string]*vexnor.QueryDefinition{
				"h1": {
					Name: "q1",
					Hash: "h1",
					Template: vexnor.TemplateNodes{
						&vexnor.TextNode{Value: "SELECT 1"},
					},
					Params: map[string]*vexnor.ParamDefinition{},
				},
			},
		}
		reg.Load(manifest)

		initCalled := false
		plugin := &testPlugin{
			name:   "test-plugin",
			onInit: func() { initCalled = true },
		}
		reg.Use(plugin)

		_, err := reg.Execute("h1", nil, nil, func(build *vexnor.SqlBuildResult) (any, error) {
			return nil, nil
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !initCalled {
			t.Fatal("expected plugin Init to be called")
		}
	})
}

func TestRegistry_LoadDirectory(t *testing.T) {
	t.Run("loads directory with matching files", func(t *testing.T) {
		dir := t.TempDir()

		manifest := `{
			"version": 1,
			"generatorVersion": "1.0.0",
			"dialect": "postgresql",
			"queries": {
				"dir_hash": {
					"name": "dirQuery",
					"hash": "dir_hash",
					"template": [{"type": "text", "value": "SELECT 1"}],
					"params": {},
					"authorization": []
				}
			}
		}`

		if err := os.WriteFile(filepath.Join(dir, "queries.json"), []byte(manifest), 0644); err != nil {
			t.Fatal(err)
		}

		reg := vexnor.NewQueryRegistry("postgresql")
		err := reg.LoadDirectory(dir, "*.json")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		q := reg.GetQuery("dir_hash")
		if q == nil {
			t.Fatal("expected to find query after LoadDirectory")
		}
		if q.Name != "dirQuery" {
			t.Errorf("expected %q, got %q", "dirQuery", q.Name)
		}
	})

	t.Run("returns error for nonexistent directory", func(t *testing.T) {
		reg := vexnor.NewQueryRegistry("postgresql")
		err := reg.LoadDirectory("/nonexistent/path", "*.json")
		if err == nil {
			t.Fatal("expected error for nonexistent directory")
		}
	})

	t.Run("returns error when no files match pattern", func(t *testing.T) {
		dir := t.TempDir()
		reg := vexnor.NewQueryRegistry("postgresql")
		err := reg.LoadDirectory(dir, "*.json")
		if err == nil {
			t.Fatal("expected error when no files match")
		}
	})
}

func TestRegistry_ValidateFilterConditions_OrGroup(t *testing.T) {
	t.Run("validates columns inside OR group", func(t *testing.T) {
		manifest := &vexnor.QueryManifest{
			Version:          1,
			GeneratorVersion: "1.0.0",
			Dialect:          "postgresql",
			Queries: map[string]*vexnor.QueryDefinition{
				"hash_or": {
					Name: "orQuery",
					Hash: "hash_or",
					Template: vexnor.TemplateNodes{
						&vexnor.TextNode{Value: "SELECT 1"},
					},
					Params: map[string]*vexnor.ParamDefinition{
						"filterBy": {
							Name: "filterBy",
							Validation: &vexnor.ParamValidationSchema{
								Type:      "filter",
								Columns:   []string{"email", "status"},
								Operators: []string{"=", "like"},
							},
						},
					},
				},
			},
		}

		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(manifest)

		// Valid OR group
		_, err := reg.Execute("hash_or", map[string]any{
			"filterBy": []any{
				map[string]any{
					"or": []any{
						map[string]any{"email": []any{"like", "%@test.com"}},
						map[string]any{"status": []any{"=", "active"}},
					},
				},
			},
		}, nil, func(build *vexnor.SqlBuildResult) (any, error) {
			return nil, nil
		})
		if err != nil {
			t.Fatalf("unexpected error for valid OR: %v", err)
		}

		// Invalid column inside OR group
		_, err = reg.Execute("hash_or", map[string]any{
			"filterBy": []any{
				map[string]any{
					"or": []any{
						map[string]any{"badColumn": []any{"=", "value"}},
					},
				},
			},
		}, nil, func(build *vexnor.SqlBuildResult) (any, error) {
			return nil, nil
		})
		if err == nil {
			t.Fatal("expected error for invalid column in OR group")
		}
		if !errors.Is(err, vexnor.ErrValidation) {
			t.Fatalf("expected ErrValidation, got %v", err)
		}
	})
}

func TestRegistry_ValidateFilterConditions_MapForm(t *testing.T) {
	t.Run("validates filter passed as map[string]any", func(t *testing.T) {
		manifest := &vexnor.QueryManifest{
			Version:          1,
			GeneratorVersion: "1.0.0",
			Dialect:          "postgresql",
			Queries: map[string]*vexnor.QueryDefinition{
				"hash_mapf": {
					Name: "mapFilterQuery",
					Hash: "hash_mapf",
					Template: vexnor.TemplateNodes{
						&vexnor.TextNode{Value: "SELECT 1"},
					},
					Params: map[string]*vexnor.ParamDefinition{
						"filterBy": {
							Name: "filterBy",
							Validation: &vexnor.ParamValidationSchema{
								Type:    "filter",
								Columns: []string{"email"},
							},
						},
					},
				},
			},
		}

		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(manifest)

		// Pass filter as map (legacy form)
		_, err := reg.Execute("hash_mapf", map[string]any{
			"filterBy": map[string]any{"email": "test@test.com"},
		}, nil, func(build *vexnor.SqlBuildResult) (any, error) {
			return nil, nil
		})
		if err != nil {
			t.Fatalf("unexpected error for map filter: %v", err)
		}

		// Invalid column in map form
		_, err = reg.Execute("hash_mapf", map[string]any{
			"filterBy": map[string]any{"badCol": "value"},
		}, nil, func(build *vexnor.SqlBuildResult) (any, error) {
			return nil, nil
		})
		if err == nil {
			t.Fatal("expected error for invalid column in map form")
		}
		if !errors.Is(err, vexnor.ErrValidation) {
			t.Fatalf("expected ErrValidation, got %v", err)
		}
	})
}

func TestRegistry_Execute_UnknownHash(t *testing.T) {
	t.Run("Execute with unknown hash returns error", func(t *testing.T) {
		reg := vexnor.NewQueryRegistry("postgresql")
		_, err := reg.Execute("nonexistent", nil, nil, func(build *vexnor.SqlBuildResult) (any, error) {
			return nil, nil
		})
		if err == nil {
			t.Fatal("expected error for unknown hash")
		}
		if !errors.Is(err, vexnor.ErrUnknownQuery) {
			t.Fatalf("expected ErrUnknownQuery, got %v", err)
		}
	})
}

func TestRegistry_Execute_OptionalContext(t *testing.T) {
	t.Run("optional context param does not error when missing", func(t *testing.T) {
		optional := true
		manifest := &vexnor.QueryManifest{
			Version:          1,
			GeneratorVersion: "1.0.0",
			Dialect:          "postgresql",
			Queries: map[string]*vexnor.QueryDefinition{
				"hash_opt": {
					Name: "optQuery",
					Hash: "hash_opt",
					Template: vexnor.TemplateNodes{
						&vexnor.TextNode{Value: "SELECT 1"},
					},
					Params: map[string]*vexnor.ParamDefinition{
						"tenantId": {Name: "tenantId", IsContext: true, Optional: &optional},
					},
				},
			},
		}

		reg := vexnor.NewQueryRegistry("postgresql")
		reg.Load(manifest)

		// No context provided — optional param should not error
		_, err := reg.Execute("hash_opt", nil, map[string]any{}, func(build *vexnor.SqlBuildResult) (any, error) {
			return "ok", nil
		})
		if err != nil {
			t.Fatalf("unexpected error for optional context: %v", err)
		}
	})
}

// --- Helper ---

type testPlugin struct {
	name   string
	onInit func()
}

func (p *testPlugin) Name() string { return p.name }
func (p *testPlugin) Init(_ *vexnor.PipelineExecutionArgs) {
	if p.onInit != nil {
		p.onInit()
	}
}
func (p *testPlugin) Check(_ *vexnor.PipelineExecutionArgs) error { return nil }
func (p *testPlugin) Before(_ *vexnor.PipelineExecutionArgs)     {}
func (p *testPlugin) End(_ *vexnor.PipelineEndArgs)              {}
func (p *testPlugin) OnError(_ error, _ *vexnor.PipelineExecutionArgs) {}
