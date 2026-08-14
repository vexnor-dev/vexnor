package duckdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/vexnor-dev/vexnor/stacks/golang/internal/testutil"
	"github.com/vexnor-dev/vexnor/stacks/golang/vexnor"
)

func TestSharedTypeScriptManifestExecutesAgainstDuckDB(t *testing.T) {
	executor, err := NewFromPath(filepath.Join(t.TempDir(), "manifest.duckdb"))
	if err != nil {
		t.Fatalf("open DuckDB: %v", err)
	}
	t.Cleanup(func() { _ = executor.Close() })

	manifest, err := vexnor.LoadFile(duckDBFixturePath("manifest.json"))
	if err != nil {
		t.Fatalf("load manifest: %v", err)
	}
	if manifest.Dialect != "duckdb" {
		t.Fatalf("manifest dialect = %q, want %q", manifest.Dialect, "duckdb")
	}
	registry := vexnor.NewQueryRegistry("duckdb")
	registry.Load(manifest)
	expected, err := loadDuckDBExpected()
	if err != nil {
		t.Fatalf("load expected results: %v", err)
	}

	ctx := context.Background()
	if _, err := executor.Execute(ctx, &vexnor.SqlBuildResult{Text: `
		CREATE SCHEMA vexnor_dev;
		CREATE TABLE vexnor_dev.account (
			account_id VARCHAR PRIMARY KEY DEFAULT uuid()::VARCHAR,
			status VARCHAR NOT NULL DEFAULT 'created',
			email VARCHAR NOT NULL,
			first_name VARCHAR NOT NULL,
			last_name VARCHAR NOT NULL,
			notes VARCHAR,
			created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
			modified_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
			parent_id VARCHAR
		);
		INSERT INTO vexnor_dev.account
			(account_id, status, email, first_name, last_name)
		VALUES
			('uuid-123', 'active', 'jane@example.com', 'Jane', 'Duck'),
			('id-2', 'confirmed', 'other@example.com', 'Other', 'Duck');
	`}); err != nil {
		t.Fatalf("create fixture schema: %v", err)
	}

	for _, name := range []string{"xFilterEquality", "xFilterOperators", "xFilterNestedOrAnd", "xOrderByMulti", "xPaginationBoth"} {
		t.Run(name, func(t *testing.T) {
			fixture := expected[name]
			params := decodeManifestParams(t, fixture.Params)
			built, err := registry.Build(name, params)
			if err != nil {
				t.Fatalf("build manifest query: %v", err)
			}
			if fixture.Text == nil || built.Text != *fixture.Text {
				t.Fatalf("SQL mismatch\nwant: %v\n got: %s", valueOrEmpty(fixture.Text), built.Text)
			}
			if !equalManifestValues(built.Values, fixture.Values) {
				t.Fatalf("values mismatch\nwant: %#v\n got: %#v", fixture.Values, built.Values)
			}
			if _, err := registry.Execute(name, params, map[string]any{}, func(query *vexnor.SqlBuildResult) (any, error) {
				return executor.QueryRows(ctx, query)
			}); err != nil {
				t.Fatalf("execute manifest query: %v", err)
			}
		})
	}

	inserted := executeManifestRows(t, ctx, registry, executor, expected, "xInsertSingle")
	updated := executeManifestRows(t, ctx, registry, executor, expected, "xSetSingle")
	if len(inserted) != 1 || inserted[0]["email"] != "a@test.com" {
		t.Fatalf("inserted rows = %#v", inserted)
	}
	if len(updated) != 1 || updated[0]["email"] != "updated@test.com" {
		t.Fatalf("updated rows = %#v", updated)
	}

	_, err = registry.Execute("missing-query", map[string]any{}, map[string]any{}, func(query *vexnor.SqlBuildResult) (any, error) {
		return executor.QueryRows(ctx, query)
	})
	if !errors.Is(err, vexnor.ErrUnknownQuery) {
		t.Fatalf("missing query error = %v", err)
	}
}

func duckDBFixturePath(fileName string) string {
	return filepath.Join(filepath.Dir(testutil.LoadManifestPath()), "duckdb", fileName)
}

func loadDuckDBExpected() (map[string]*testutil.ExpectedResult, error) {
	data, err := os.ReadFile(duckDBFixturePath("expected.json"))
	if err != nil {
		return nil, err
	}
	var results map[string]*testutil.ExpectedResult
	if err := json.Unmarshal(data, &results); err != nil {
		return nil, err
	}
	return results, nil
}

func executeManifestRows(
	t *testing.T,
	ctx context.Context,
	registry *vexnor.QueryRegistry,
	executor *Executor,
	expected map[string]*testutil.ExpectedResult,
	hash string,
) []map[string]any {
	t.Helper()
	result, err := registry.Execute(hash, decodeManifestParams(t, expected[hash].Params), map[string]any{}, func(query *vexnor.SqlBuildResult) (any, error) {
		return executor.QueryRows(ctx, query)
	})
	if err != nil {
		t.Fatalf("execute %s: %v", hash, err)
	}
	rows, ok := result.([]map[string]any)
	if !ok {
		t.Fatalf("%s result has type %T", hash, result)
	}
	return rows
}

func decodeManifestParams(t *testing.T, raw json.RawMessage) map[string]any {
	t.Helper()
	decoded, err := decodeJSONOrdered(json.NewDecoder(strings.NewReader(string(raw))))
	if err != nil {
		t.Fatalf("decode manifest params: %v", err)
	}
	if params, ok := decoded.(*vexnor.OrderedDict); ok {
		return params.ToMap()
	}
	return map[string]any{}
}

func decodeJSONOrdered(decoder *json.Decoder) (any, error) {
	token, err := decoder.Token()
	if err != nil {
		return nil, err
	}
	switch value := token.(type) {
	case json.Delim:
		switch value {
		case '{':
			object := vexnor.NewOrderedDict()
			for decoder.More() {
				key, err := decoder.Token()
				if err != nil {
					return nil, err
				}
				entry, err := decodeJSONOrdered(decoder)
				if err != nil {
					return nil, err
				}
				object.Set(key.(string), entry)
			}
			_, err := decoder.Token()
			return object, err
		case '[':
			array := []any{}
			for decoder.More() {
				entry, err := decodeJSONOrdered(decoder)
				if err != nil {
					return nil, err
				}
				array = append(array, entry)
			}
			_, err := decoder.Token()
			return array, err
		}
	case nil, bool, float64, string:
		return value, nil
	}
	return nil, fmt.Errorf("unexpected JSON token: %v", token)
}

func equalManifestValues(actual, expected []any) bool {
	if len(actual) != len(expected) {
		return false
	}
	for index := range actual {
		if fmt.Sprint(actual[index]) != fmt.Sprint(expected[index]) {
			return false
		}
	}
	return true
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
