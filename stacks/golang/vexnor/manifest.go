package vexnor

import (
	"encoding/json"
	"fmt"
)

// QueryManifest represents the top-level query manifest structure.
type QueryManifest struct {
	Version          int                         `json:"version"`
	GeneratorVersion string                      `json:"generatorVersion"`
	Dialect          string                      `json:"dialect"`
	Queries          map[string]*QueryDefinition `json:"queries"`
}

// QueryDefinition represents a single query entry in the manifest.
type QueryDefinition struct {
	Name          string                      `json:"name"`
	Location      string                      `json:"location"`
	Hash          string                      `json:"hash"`
	Template      TemplateNodes               `json:"template"`
	Params        map[string]*ParamDefinition `json:"params"`
	Row           map[string]*ColumnSchema    `json:"row"`
	Authorization []string                    `json:"authorization"`
}

// ParamDefinition describes a parameter declared on a query.
type ParamDefinition struct {
	Name        string                 `json:"name"`
	IsContext   bool                   `json:"isContext"`
	Optional    *bool                  `json:"optional,omitempty"`
	Label       *string                `json:"label,omitempty"`
	Description *string                `json:"description,omitempty"`
	Validation  *ParamValidationSchema `json:"validation,omitempty"`
}

// ParamValidationSchema describes the validation rules for a parameter.
type ParamValidationSchema struct {
	Type      string   `json:"type"`
	Columns   []string `json:"columns"`
	Operators []string `json:"operators,omitempty"`
	Functions []string `json:"functions,omitempty"`
}

// ColumnSchema describes a column's type in the result row.
type ColumnSchema struct {
	Type string `json:"type"`
}

// TemplateNode is the interface implemented by all template node types.
type TemplateNode interface {
	templateNode()
}

// TemplateNodes is a slice of TemplateNode with custom JSON unmarshaling
// that handles the polymorphic "type" discriminator.
type TemplateNodes []TemplateNode

// UnmarshalJSON deserializes a JSON array of template nodes, dispatching
// each element to the correct concrete type based on the "type" field.
func (tn *TemplateNodes) UnmarshalJSON(data []byte) error {
	var raw []json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshal template nodes: %w", err)
	}

	nodes := make([]TemplateNode, 0, len(raw))
	for i, item := range raw {
		node, err := unmarshalTemplateNode(item)
		if err != nil {
			return fmt.Errorf("unmarshal template node[%d]: %w", i, err)
		}
		nodes = append(nodes, node)
	}

	*tn = nodes
	return nil
}

// MarshalJSON serializes the TemplateNodes slice, including the "type"
// discriminator on each node.
func (tn TemplateNodes) MarshalJSON() ([]byte, error) {
	items := make([]json.RawMessage, 0, len(tn))
	for _, node := range tn {
		data, err := marshalTemplateNode(node)
		if err != nil {
			return nil, err
		}
		items = append(items, data)
	}
	return json.Marshal(items)
}

func unmarshalTemplateNode(data json.RawMessage) (TemplateNode, error) {
	var discriminator struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(data, &discriminator); err != nil {
		return nil, fmt.Errorf("read type discriminator: %w", err)
	}

	switch discriminator.Type {
	case "text":
		var n TextNode
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, err
		}
		return &n, nil
	case "param":
		var n ParamNode
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, err
		}
		return &n, nil
	case "value":
		var n ValueNode
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, err
		}
		return &n, nil
	case "when":
		var n WhenNode
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, err
		}
		return &n, nil
	case "set":
		var n SetNode
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, err
		}
		return &n, nil
	case "insert":
		var n InsertNode
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, err
		}
		return &n, nil
	case "insertCols":
		var n InsertColsNode
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, err
		}
		return &n, nil
	case "insertValues":
		var n InsertValuesNode
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, err
		}
		return &n, nil
	case "filter":
		var n FilterNode
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, err
		}
		return &n, nil
	case "orderBy":
		var n OrderByNode
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, err
		}
		return &n, nil
	case "projection":
		var n ProjectionNode
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, err
		}
		return &n, nil
	case "pagination":
		var n PaginationNode
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, err
		}
		return &n, nil
	case "joinBy":
		var n JoinByNode
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, err
		}
		return &n, nil
	case "upsert":
		var n UpsertNode
		if err := json.Unmarshal(data, &n); err != nil {
			return nil, err
		}
		return &n, nil
	default:
		return nil, fmt.Errorf("unknown template node type: %q", discriminator.Type)
	}
}

func marshalTemplateNode(node TemplateNode) (json.RawMessage, error) {
	var typeName string
	switch node.(type) {
	case *TextNode:
		typeName = "text"
	case *ParamNode:
		typeName = "param"
	case *ValueNode:
		typeName = "value"
	case *WhenNode:
		typeName = "when"
	case *SetNode:
		typeName = "set"
	case *InsertNode:
		typeName = "insert"
	case *InsertColsNode:
		typeName = "insertCols"
	case *InsertValuesNode:
		typeName = "insertValues"
	case *FilterNode:
		typeName = "filter"
	case *OrderByNode:
		typeName = "orderBy"
	case *ProjectionNode:
		typeName = "projection"
	case *PaginationNode:
		typeName = "pagination"
	case *JoinByNode:
		typeName = "joinBy"
	case *UpsertNode:
		typeName = "upsert"
	default:
		return nil, fmt.Errorf("unknown template node type: %T", node)
	}

	data, err := json.Marshal(node)
	if err != nil {
		return nil, err
	}

	// Inject the "type" field into the serialized JSON object.
	var m map[string]json.RawMessage
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	typeBytes, _ := json.Marshal(typeName)
	m["type"] = typeBytes
	return json.Marshal(m)
}

// TextNode represents a literal SQL text fragment.
type TextNode struct {
	Value string `json:"value"`
}

func (*TextNode) templateNode() {}

// ParamNode represents a parameterized placeholder.
type ParamNode struct {
	Name  string `json:"name"`
	Array bool   `json:"array"`
}

func (*ParamNode) templateNode() {}

// ValueNode represents a literal value embedded in the template.
type ValueNode struct {
	Value any `json:"value"`
}

func (*ValueNode) templateNode() {}

// WhenNode represents a conditional template branch.
type WhenNode struct {
	Param   string        `json:"param"`
	Negate  bool          `json:"negate"`
	OnTrue  TemplateNodes `json:"onTrue"`
	OnFalse TemplateNodes `json:"onFalse,omitempty"`
}

func (*WhenNode) templateNode() {}

// SetNode represents a SET clause for UPDATE statements.
type SetNode struct {
	Param   string      `json:"param"`
	Columns *OrderedMap `json:"columns"`
}

func (*SetNode) templateNode() {}

// InsertNode represents a full INSERT clause.
type InsertNode struct {
	Param   string      `json:"param"`
	Columns *OrderedMap `json:"columns"`
}

func (*InsertNode) templateNode() {}

// InsertColsNode represents the column list portion of an INSERT.
type InsertColsNode struct {
	Param   string      `json:"param"`
	Columns *OrderedMap `json:"columns"`
}

func (*InsertColsNode) templateNode() {}

// InsertValuesNode represents the VALUES portion of an INSERT.
type InsertValuesNode struct {
	Param string   `json:"param"`
	Keys  []string `json:"keys"`
}

func (*InsertValuesNode) templateNode() {}

// FilterNode represents a dynamic WHERE filter clause.
type FilterNode struct {
	Param   string      `json:"param"`
	Columns *OrderedMap `json:"columns"`
	Prefix  *string     `json:"prefix,omitempty"`
	Suffix  *string     `json:"suffix,omitempty"`
}

func (*FilterNode) templateNode() {}

// OrderByNode represents a dynamic ORDER BY clause.
type OrderByNode struct {
	Param   string      `json:"param"`
	Columns *OrderedMap `json:"columns"`
}

func (*OrderByNode) templateNode() {}

// ProjectionNode represents a dynamic column projection.
type ProjectionNode struct {
	Param   string      `json:"param"`
	Columns *OrderedMap `json:"columns"`
}

func (*ProjectionNode) templateNode() {}

// PaginationNode represents a LIMIT/OFFSET pagination clause.
type PaginationNode struct{}

func (*PaginationNode) templateNode() {}

// JoinByNode represents a dynamic JOIN clause.
type JoinByNode struct {
	Param     string                     `json:"param"`
	JoinMap   map[string]*JoinByTableDef `json:"joinMap"`
	JoinTypes map[string]string          `json:"joinTypes"`
}

func (*JoinByNode) templateNode() {}

// JoinByTableDef describes a table in a JoinByNode.
type JoinByTableDef struct {
	Schema  string      `json:"schema"`
	Table   string      `json:"table"`
	Columns *OrderedMap `json:"columns"`
}

// UpsertNode represents an INSERT ... ON CONFLICT UPDATE clause.
type UpsertNode struct {
	Param        string      `json:"param"`
	Columns      *OrderedMap `json:"columns"`
	ConflictKeys []string    `json:"conflictKeys"`
	TableName    string      `json:"tableName"`
}

func (*UpsertNode) templateNode() {}
