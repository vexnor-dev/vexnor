package vexnor

import (
	"bytes"
	"encoding/json"
	"fmt"
)

// OrderedMap preserves JSON key insertion order for column maps.
// Standard Go maps do not guarantee iteration order, but the query manifest
// relies on column order being deterministic (matching the order in which
// columns were declared in the TypeScript schema definition).
type OrderedMap struct {
	Keys   []string
	Values map[string]string
}

// NewOrderedMap creates an empty OrderedMap.
func NewOrderedMap() *OrderedMap {
	return &OrderedMap{
		Keys:   nil,
		Values: make(map[string]string),
	}
}

// Set adds or updates a key-value pair. If the key is new, it is appended
// to the end of the key order.
func (om *OrderedMap) Set(key, value string) {
	if _, exists := om.Values[key]; !exists {
		om.Keys = append(om.Keys, key)
	}
	om.Values[key] = value
}

// Get returns the value for a key and whether it exists.
func (om *OrderedMap) Get(key string) (string, bool) {
	v, ok := om.Values[key]
	return v, ok
}

// Len returns the number of entries.
func (om *OrderedMap) Len() int {
	return len(om.Keys)
}

// UnmarshalJSON deserializes a JSON object while preserving key order.
// It uses json.Decoder's Token API to read keys in document order.
func (om *OrderedMap) UnmarshalJSON(data []byte) error {
	om.Keys = nil
	om.Values = make(map[string]string)

	// Handle null
	if string(data) == "null" {
		return nil
	}

	dec := json.NewDecoder(bytes.NewReader(data))

	// Read opening {
	t, err := dec.Token()
	if err != nil {
		return fmt.Errorf("orderedmap: expected '{': %w", err)
	}
	if delim, ok := t.(json.Delim); !ok || delim != '{' {
		return fmt.Errorf("orderedmap: expected '{', got %v", t)
	}

	for dec.More() {
		// Read key
		keyToken, err := dec.Token()
		if err != nil {
			return fmt.Errorf("orderedmap: reading key: %w", err)
		}
		key, ok := keyToken.(string)
		if !ok {
			return fmt.Errorf("orderedmap: expected string key, got %T", keyToken)
		}

		// Read value
		var value string
		if err := dec.Decode(&value); err != nil {
			return fmt.Errorf("orderedmap: reading value for key %q: %w", key, err)
		}

		om.Keys = append(om.Keys, key)
		om.Values[key] = value
	}

	// Read closing }
	if _, err := dec.Token(); err != nil {
		return fmt.Errorf("orderedmap: expected '}': %w", err)
	}

	return nil
}

// MarshalJSON serializes the OrderedMap preserving key order.
func (om *OrderedMap) MarshalJSON() ([]byte, error) {
	if om == nil || om.Values == nil {
		return []byte("null"), nil
	}

	buf := []byte{'{'}
	for i, key := range om.Keys {
		if i > 0 {
			buf = append(buf, ',')
		}
		keyBytes, err := json.Marshal(key)
		if err != nil {
			return nil, err
		}
		valBytes, err := json.Marshal(om.Values[key])
		if err != nil {
			return nil, err
		}
		buf = append(buf, keyBytes...)
		buf = append(buf, ':')
		buf = append(buf, valBytes...)
	}
	buf = append(buf, '}')
	return buf, nil
}

// OrderedDict is an order-preserving dictionary for runtime params.
// Unlike OrderedMap (which maps string→string for manifest columns),
// OrderedDict maps string→any for runtime parameter values where
// iteration order must match JSON insertion order (for cross-runtime parity).
type OrderedDict struct {
	keys   []string
	values map[string]any
}

// NewOrderedDict creates an empty OrderedDict.
func NewOrderedDict() *OrderedDict {
	return &OrderedDict{values: make(map[string]any)}
}

// Set adds or updates a key-value pair, preserving insertion order.
func (d *OrderedDict) Set(key string, value any) {
	if _, exists := d.values[key]; !exists {
		d.keys = append(d.keys, key)
	}
	d.values[key] = value
}

// Get retrieves a value by key.
func (d *OrderedDict) Get(key string) (any, bool) {
	v, ok := d.values[key]
	return v, ok
}

// OrderedKeys returns the keys in insertion order.
func (d *OrderedDict) OrderedKeys() []string {
	return d.keys
}

// Len returns the number of entries.
func (d *OrderedDict) Len() int {
	return len(d.keys)
}

// ToMap converts to a regular map (loses order at this level only).
// Nested *OrderedDict values are preserved as-is for the SqlBuilder to handle.
func (d *OrderedDict) ToMap() map[string]any {
	result := make(map[string]any, len(d.keys))
	for _, k := range d.keys {
		result[k] = d.values[k]
	}
	return result
}
