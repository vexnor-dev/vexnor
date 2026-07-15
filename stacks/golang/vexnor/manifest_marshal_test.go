package vexnor_test

import (
	"encoding/json"
	"testing"

	"github.com/vexnor-dev/vexnor/stacks/golang/vexnor"
)

func TestMarshalTemplateNode_AllTypes(t *testing.T) {
	tests := []struct {
		name     string
		nodes    vexnor.TemplateNodes
		wantType string
	}{
		{
			name:     "TextNode",
			nodes:    vexnor.TemplateNodes{&vexnor.TextNode{Value: "SELECT 1"}},
			wantType: "text",
		},
		{
			name:     "ParamNode",
			nodes:    vexnor.TemplateNodes{&vexnor.ParamNode{Name: "id", Array: true}},
			wantType: "param",
		},
		{
			name:     "ValueNode",
			nodes:    vexnor.TemplateNodes{&vexnor.ValueNode{Value: 42}},
			wantType: "value",
		},
		{
			name: "WhenNode",
			nodes: vexnor.TemplateNodes{&vexnor.WhenNode{
				Param:  "flag",
				Negate: true,
				OnTrue: vexnor.TemplateNodes{&vexnor.TextNode{Value: "TRUE"}},
			}},
			wantType: "when",
		},
		{
			name: "SetNode",
			nodes: vexnor.TemplateNodes{&vexnor.SetNode{
				Param:   "set",
				Columns: makeColumns("name", `"name"`),
			}},
			wantType: "set",
		},
		{
			name: "InsertNode",
			nodes: vexnor.TemplateNodes{&vexnor.InsertNode{
				Param:   "rows",
				Columns: makeColumns("email", `"email"`),
			}},
			wantType: "insert",
		},
		{
			name: "InsertColsNode",
			nodes: vexnor.TemplateNodes{&vexnor.InsertColsNode{
				Param:   "rows",
				Columns: makeColumns("email", `"email"`),
			}},
			wantType: "insertCols",
		},
		{
			name: "InsertValuesNode",
			nodes: vexnor.TemplateNodes{&vexnor.InsertValuesNode{
				Param: "rows",
				Keys:  []string{"email"},
			}},
			wantType: "insertValues",
		},
		{
			name: "FilterNode",
			nodes: vexnor.TemplateNodes{&vexnor.FilterNode{
				Param:   "filterBy",
				Columns: makeColumns("status", `"status"`),
			}},
			wantType: "filter",
		},
		{
			name: "OrderByNode",
			nodes: vexnor.TemplateNodes{&vexnor.OrderByNode{
				Param:   "orderBy",
				Columns: makeColumns("name", `"name"`),
			}},
			wantType: "orderBy",
		},
		{
			name: "ProjectionNode",
			nodes: vexnor.TemplateNodes{&vexnor.ProjectionNode{
				Param:   "projection",
				Columns: makeColumns("id", `"id"`),
			}},
			wantType: "projection",
		},
		{
			name:     "PaginationNode",
			nodes:    vexnor.TemplateNodes{&vexnor.PaginationNode{}},
			wantType: "pagination",
		},
		{
			name: "JoinByNode",
			nodes: vexnor.TemplateNodes{&vexnor.JoinByNode{
				Param: "joinBy",
				JoinMap: map[string]*vexnor.JoinByTableDef{
					"_": {Schema: "public", Table: "t", Columns: makeColumns("id", `"id"`)},
				},
				JoinTypes: map[string]string{},
			}},
			wantType: "joinBy",
		},
		{
			name: "UpsertNode",
			nodes: vexnor.TemplateNodes{&vexnor.UpsertNode{
				Param:        "rows",
				Columns:      makeColumns("id", `"id"`, "name", `"name"`),
				ConflictKeys: []string{"id"},
				TableName:    "accounts",
			}},
			wantType: "upsert",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name+"_roundtrip", func(t *testing.T) {
			// Marshal
			data, err := json.Marshal(tt.nodes)
			if err != nil {
				t.Fatalf("marshal error: %v", err)
			}

			// Verify type discriminator is present
			var raw []map[string]json.RawMessage
			if err := json.Unmarshal(data, &raw); err != nil {
				t.Fatalf("unmarshal raw: %v", err)
			}
			if len(raw) != 1 {
				t.Fatalf("expected 1 node, got %d", len(raw))
			}
			typeField, ok := raw[0]["type"]
			if !ok {
				t.Fatal("missing type discriminator")
			}
			var typeName string
			if err := json.Unmarshal(typeField, &typeName); err != nil {
				t.Fatalf("unmarshal type: %v", err)
			}
			if typeName != tt.wantType {
				t.Errorf("expected type %q, got %q", tt.wantType, typeName)
			}

			// Unmarshal back
			var nodes2 vexnor.TemplateNodes
			if err := json.Unmarshal(data, &nodes2); err != nil {
				t.Fatalf("unmarshal error: %v", err)
			}
			if len(nodes2) != 1 {
				t.Fatalf("expected 1 node after unmarshal, got %d", len(nodes2))
			}
		})
	}
}

func TestUnmarshalTemplateNode_UnknownType(t *testing.T) {
	t.Run("unknown type returns error", func(t *testing.T) {
		data := []byte(`[{"type": "unknownNodeType", "value": "x"}]`)

		var nodes vexnor.TemplateNodes
		err := json.Unmarshal(data, &nodes)
		if err == nil {
			t.Fatal("expected error for unknown node type")
		}
	})
}

func TestMarshalJSON_FullManifestRoundTrip(t *testing.T) {
	t.Run("full manifest with all node types round-trips", func(t *testing.T) {
		prefix := " WHERE "
		manifest := &vexnor.QueryManifest{
			Version:          1,
			GeneratorVersion: "1.0.0",
			Dialect:          "postgresql",
			Queries: map[string]*vexnor.QueryDefinition{
				"hash_full": {
					Name:     "fullQuery",
					Hash:     "hash_full",
					Location: "src/q.ts:1",
					Template: vexnor.TemplateNodes{
						&vexnor.TextNode{Value: "SELECT "},
						&vexnor.ProjectionNode{
							Param:   "projection",
							Columns: makeColumns("id", `"id"`, "name", `"name"`),
						},
						&vexnor.TextNode{Value: " FROM t"},
						&vexnor.FilterNode{
							Param:   "filterBy",
							Columns: makeColumns("status", `"status"`),
							Prefix:  &prefix,
						},
						&vexnor.OrderByNode{
							Param:   "orderBy",
							Columns: makeColumns("name", `"name"`),
						},
						&vexnor.PaginationNode{},
					},
					Params:        map[string]*vexnor.ParamDefinition{},
					Authorization: []string{},
				},
			},
		}

		data, err := json.Marshal(manifest)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		loaded, err := vexnor.LoadJSON(data)
		if err != nil {
			t.Fatalf("load error: %v", err)
		}

		q := loaded.Queries["hash_full"]
		if q == nil {
			t.Fatal("expected query after round-trip")
		}
		if len(q.Template) != 6 {
			t.Fatalf("expected 6 template nodes, got %d", len(q.Template))
		}
	})
}
