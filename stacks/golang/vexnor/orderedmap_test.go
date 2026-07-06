package vexnor_test

import (
	"encoding/json"
	"testing"

	"github.com/vexnor-dev/vexnor-go/vexnor"
)

func TestOrderedMap_NewAndSet(t *testing.T) {
	t.Run("NewOrderedMap creates empty map", func(t *testing.T) {
		om := vexnor.NewOrderedMap()
		if om.Len() != 0 {
			t.Fatalf("expected empty map, got len %d", om.Len())
		}
	})

	t.Run("Set adds key-value pair in order", func(t *testing.T) {
		om := vexnor.NewOrderedMap()
		om.Set("b", "val_b")
		om.Set("a", "val_a")
		om.Set("c", "val_c")

		if om.Len() != 3 {
			t.Fatalf("expected 3 entries, got %d", om.Len())
		}

		// Keys preserve insertion order
		expectedKeys := []string{"b", "a", "c"}
		for i, k := range om.Keys {
			if k != expectedKeys[i] {
				t.Errorf("key[%d]: expected %q, got %q", i, expectedKeys[i], k)
			}
		}

		v, ok := om.Get("a")
		if !ok || v != "val_a" {
			t.Errorf("expected val_a, got %q (ok=%v)", v, ok)
		}
	})

	t.Run("Set updates existing key without reordering", func(t *testing.T) {
		om := vexnor.NewOrderedMap()
		om.Set("x", "original")
		om.Set("y", "second")
		om.Set("x", "updated")

		if om.Len() != 2 {
			t.Fatalf("expected 2 entries after update, got %d", om.Len())
		}

		v, _ := om.Get("x")
		if v != "updated" {
			t.Errorf("expected updated value, got %q", v)
		}

		// Order preserved: x first, y second
		if om.Keys[0] != "x" || om.Keys[1] != "y" {
			t.Errorf("expected keys [x, y], got %v", om.Keys)
		}
	})
}

func TestOrderedMap_MarshalJSON(t *testing.T) {
	t.Run("marshals in insertion order", func(t *testing.T) {
		om := vexnor.NewOrderedMap()
		om.Set("z", "last")
		om.Set("a", "first")
		om.Set("m", "middle")

		data, err := om.MarshalJSON()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		expected := `{"z":"last","a":"first","m":"middle"}`
		if string(data) != expected {
			t.Errorf("expected %s, got %s", expected, string(data))
		}
	})

	t.Run("nil map marshals to null", func(t *testing.T) {
		var om *vexnor.OrderedMap
		data, err := om.MarshalJSON()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if string(data) != "null" {
			t.Errorf("expected null, got %s", string(data))
		}
	})

	t.Run("map with nil Values marshals to null", func(t *testing.T) {
		om := &vexnor.OrderedMap{Keys: nil, Values: nil}
		data, err := om.MarshalJSON()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if string(data) != "null" {
			t.Errorf("expected null, got %s", string(data))
		}
	})

	t.Run("empty map marshals to {}", func(t *testing.T) {
		om := vexnor.NewOrderedMap()
		data, err := om.MarshalJSON()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if string(data) != "{}" {
			t.Errorf("expected {}, got %s", string(data))
		}
	})

	t.Run("JSON round-trip preserves order", func(t *testing.T) {
		om := vexnor.NewOrderedMap()
		om.Set("c", "3")
		om.Set("a", "1")
		om.Set("b", "2")

		data, err := json.Marshal(om)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var om2 vexnor.OrderedMap
		if err := json.Unmarshal(data, &om2); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if om2.Len() != 3 {
			t.Fatalf("expected 3 entries, got %d", om2.Len())
		}
		expectedKeys := []string{"c", "a", "b"}
		for i, k := range om2.Keys {
			if k != expectedKeys[i] {
				t.Errorf("key[%d]: expected %q, got %q", i, expectedKeys[i], k)
			}
		}
	})
}
