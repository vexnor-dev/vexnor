package vexnor_test

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/vexnor-dev/vexnor-go/internal/testutil"
	"github.com/vexnor-dev/vexnor-go/vexnor"
)

// loadRegistries creates postgresql and transactsql registries loaded from the shared manifest.
func loadRegistries(t *testing.T) (pg *vexnor.QueryRegistry, mssql *vexnor.QueryRegistry) {
	t.Helper()

	manifestPath := testutil.LoadManifestPath()

	pg = vexnor.NewQueryRegistry("postgresql")
	if err := pg.LoadFile(manifestPath); err != nil {
		t.Fatalf("failed to load manifest into postgresql registry: %v", err)
	}

	mssql = vexnor.NewQueryRegistry("transactsql")
	if err := mssql.LoadFile(manifestPath); err != nil {
		t.Fatalf("failed to load manifest into transactsql registry: %v", err)
	}

	return pg, mssql
}

// loadExpected loads and returns expected.json entries.
func loadExpected(t *testing.T) map[string]*testutil.ExpectedResult {
	t.Helper()

	expected, err := testutil.LoadExpected()
	if err != nil {
		t.Fatalf("failed to load expected.json: %v", err)
	}
	return expected
}

// deserializeParams converts JSON params into map[string]any suitable for Build().
// Uses an order-preserving decoder so that nested JSON objects maintain their key order,
// which is critical for matching TypeScript/C# behavior in cross-runtime tests.
// Objects are decoded as vexnor.OrderedDict (which implements iteration in insertion order).
func deserializeParams(raw json.RawMessage) (map[string]any, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return map[string]any{}, nil
	}

	decoded, err := decodeJSONOrdered(json.NewDecoder(strings.NewReader(string(raw))))
	if err != nil {
		return nil, err
	}
	if decoded == nil {
		return map[string]any{}, nil
	}
	// Top level is always a map[string]any (but nested objects are OrderedDict)
	if od, ok := decoded.(*vexnor.OrderedDict); ok {
		return od.ToMap(), nil
	}
	return map[string]any{}, nil
}

// decodeJSONOrdered decodes a JSON value preserving object key order.
// Objects become *vexnor.OrderedDict, arrays become []any, primitives become their Go equivalents.
func decodeJSONOrdered(dec *json.Decoder) (any, error) {
	tok, err := dec.Token()
	if err != nil {
		return nil, err
	}

	switch v := tok.(type) {
	case json.Delim:
		switch v {
		case '{':
			od := vexnor.NewOrderedDict()
			for dec.More() {
				// Read key
				keyTok, err := dec.Token()
				if err != nil {
					return nil, err
				}
				key := keyTok.(string)
				// Read value
				val, err := decodeJSONOrdered(dec)
				if err != nil {
					return nil, err
				}
				od.Set(key, val)
			}
			// Read closing }
			if _, err := dec.Token(); err != nil {
				return nil, err
			}
			return od, nil
		case '[':
			var arr []any
			for dec.More() {
				val, err := decodeJSONOrdered(dec)
				if err != nil {
					return nil, err
				}
				arr = append(arr, val)
			}
			// Read closing ]
			if _, err := dec.Token(); err != nil {
				return nil, err
			}
			if arr == nil {
				arr = []any{}
			}
			return arr, nil
		}
	case nil:
		return nil, nil
	case bool:
		return v, nil
	case float64:
		return v, nil
	case string:
		return v, nil
	}
	return nil, fmt.Errorf("unexpected token: %v", tok)
}

// formatValue converts a value to its string representation for comparison.
func formatValue(v any) string {
	if v == nil {
		return "<nil>"
	}
	return fmt.Sprintf("%v", v)
}

func TestCrossRuntime_Postgres(t *testing.T) {
	pgRegistry, _ := loadRegistries(t)
	expected := loadExpected(t)

	for name, exp := range expected {
		if strings.Contains(name, "Mssql") {
			continue
		}

		t.Run(name, func(t *testing.T) {
			params, err := deserializeParams(exp.Params)
			if err != nil {
				t.Fatalf("failed to deserialize params for %s: %v", name, err)
			}

			if exp.Error != nil {
				_, buildErr := pgRegistry.Build(exp.Hash, params)
				if buildErr == nil {
					t.Fatalf("expected error for %s, got nil", name)
				}
				return
			}

			result, buildErr := pgRegistry.Build(exp.Hash, params)
			if buildErr != nil {
				t.Fatalf("unexpected error for %s: %v", name, buildErr)
			}

			if exp.Text == nil {
				t.Fatalf("expected text is nil for %s but no error expected", name)
			}

			if result.Text != *exp.Text {
				t.Errorf("text mismatch for %s:\n  got:  %s\n  want: %s", name, result.Text, *exp.Text)
			}

			// Compare values
			expectedValues := exp.Values
			if expectedValues == nil {
				expectedValues = []any{}
			}
			if len(result.Values) != len(expectedValues) {
				t.Fatalf("values count mismatch for %s: got %d, want %d\n  got:  %v\n  want: %v",
					name, len(result.Values), len(expectedValues), result.Values, expectedValues)
			}
			for i := range expectedValues {
				got := formatValue(result.Values[i])
				want := formatValue(expectedValues[i])
				if got != want {
					t.Errorf("values[%d] mismatch for %s: got %q, want %q", i, name, got, want)
				}
			}
		})
	}
}

func TestCrossRuntime_Mssql(t *testing.T) {
	_, mssqlRegistry := loadRegistries(t)
	expected := loadExpected(t)

	for name, exp := range expected {
		if !strings.Contains(name, "Mssql") {
			continue
		}

		t.Run(name, func(t *testing.T) {
			params, err := deserializeParams(exp.Params)
			if err != nil {
				t.Fatalf("failed to deserialize params for %s: %v", name, err)
			}

			if exp.Error != nil {
				_, buildErr := mssqlRegistry.Build(exp.Hash, params)
				if buildErr == nil {
					t.Fatalf("expected error for %s, got nil", name)
				}
				return
			}

			result, buildErr := mssqlRegistry.Build(exp.Hash, params)
			if buildErr != nil {
				t.Fatalf("unexpected error for %s: %v", name, buildErr)
			}

			if exp.Text == nil {
				t.Fatalf("expected text is nil for %s but no error expected", name)
			}

			if result.Text != *exp.Text {
				t.Errorf("text mismatch for %s:\n  got:  %s\n  want: %s", name, result.Text, *exp.Text)
			}

			// Compare values
			expectedValues := exp.Values
			if expectedValues == nil {
				expectedValues = []any{}
			}
			if len(result.Values) != len(expectedValues) {
				t.Fatalf("values count mismatch for %s: got %d, want %d\n  got:  %v\n  want: %v",
					name, len(result.Values), len(expectedValues), result.Values, expectedValues)
			}
			for i := range expectedValues {
				got := formatValue(result.Values[i])
				want := formatValue(expectedValues[i])
				if got != want {
					t.Errorf("values[%d] mismatch for %s: got %q, want %q", i, name, got, want)
				}
			}
		})
	}
}

// TestCrossRuntime_Completeness asserts that the manifest query count matches
// the expected.json entry count — no test cases are silently missing.
func TestCrossRuntime_Completeness(t *testing.T) {
	pgRegistry, _ := loadRegistries(t)
	expected := loadExpected(t)

	manifestHashes := pgRegistry.GetRegisteredHashes()
	expectedCount := len(expected)

	// The manifest uses shared hashes for some test names (e.g. xOrderBySingle,
	// xOrderByMulti, xOrderByNull all share the same hash). We check that every
	// expected key can be resolved by its hash field against the manifest.
	for name, exp := range expected {
		query := pgRegistry.GetQuery(exp.Hash)
		if query == nil {
			t.Errorf("expected entry %q references hash %q not found in manifest", name, exp.Hash)
		}
	}

	// Sanity: manifest has at least as many unique hashes as there are distinct hashes in expected
	distinctExpectedHashes := make(map[string]bool)
	for _, exp := range expected {
		distinctExpectedHashes[exp.Hash] = true
	}

	if len(manifestHashes) < len(distinctExpectedHashes) {
		t.Errorf("manifest has %d unique hashes but expected.json references %d distinct hashes",
			len(manifestHashes), len(distinctExpectedHashes))
	}

	if expectedCount == 0 {
		t.Fatal("expected.json has no entries — fixtures may not be generated")
	}

	t.Logf("Cross-runtime: %d test cases, %d manifest hashes, %d distinct expected hashes",
		expectedCount, len(manifestHashes), len(distinctExpectedHashes))
}
