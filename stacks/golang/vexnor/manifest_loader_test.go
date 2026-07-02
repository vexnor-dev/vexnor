package vexnor_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/vexnor-dev/vexnor-go/vexnor"
)

func TestLoadJSON_ValidManifest(t *testing.T) {
	t.Run("parses valid manifest with text node", func(t *testing.T) {
		data := []byte(`{
			"version": 1,
			"generatorVersion": "1.0.0",
			"dialect": "postgresql",
			"queries": {
				"hash1": {
					"name": "testQuery",
					"hash": "hash1",
					"location": "src/test.ts:1",
					"template": [{"type": "text", "value": "SELECT 1"}],
					"params": {},
					"authorization": []
				}
			}
		}`)

		manifest, err := vexnor.LoadJSON(data)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if manifest == nil {
			t.Fatal("expected non-nil manifest")
		}
		if manifest.Version != 1 {
			t.Errorf("expected version 1, got %d", manifest.Version)
		}
		if manifest.GeneratorVersion != "1.0.0" {
			t.Errorf("expected generatorVersion %q, got %q", "1.0.0", manifest.GeneratorVersion)
		}
		if manifest.Dialect != "postgresql" {
			t.Errorf("expected dialect %q, got %q", "postgresql", manifest.Dialect)
		}
		if len(manifest.Queries) != 1 {
			t.Fatalf("expected 1 query, got %d", len(manifest.Queries))
		}

		q := manifest.Queries["hash1"]
		if q == nil {
			t.Fatal("expected query at hash1")
		}
		if q.Name != "testQuery" {
			t.Errorf("expected name %q, got %q", "testQuery", q.Name)
		}
		if q.Location != "src/test.ts:1" {
			t.Errorf("expected location %q, got %q", "src/test.ts:1", q.Location)
		}
	})

	t.Run("parses manifest with param node", func(t *testing.T) {
		data := []byte(`{
			"version": 1,
			"generatorVersion": "1.2.3",
			"dialect": "postgresql",
			"queries": {
				"hashP": {
					"name": "paramQuery",
					"hash": "hashP",
					"location": "src/test.ts:10",
					"template": [
						{"type": "text", "value": "SELECT * FROM t WHERE id = "},
						{"type": "param", "name": "id", "array": false}
					],
					"params": {
						"id": {"name": "id", "isContext": false}
					},
					"authorization": ["user"]
				}
			}
		}`)

		manifest, err := vexnor.LoadJSON(data)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		q := manifest.Queries["hashP"]
		if q == nil {
			t.Fatal("expected query at hashP")
		}
		if len(q.Authorization) != 1 || q.Authorization[0] != "user" {
			t.Errorf("expected authorization [user], got %v", q.Authorization)
		}
		if len(q.Params) != 1 {
			t.Fatalf("expected 1 param, got %d", len(q.Params))
		}
		if q.Params["id"] == nil {
			t.Fatal("expected param 'id'")
		}
		if q.Params["id"].IsContext {
			t.Error("expected IsContext to be false")
		}
	})

	t.Run("parses manifest with context param", func(t *testing.T) {
		data := []byte(`{
			"version": 1,
			"generatorVersion": "1.0.0",
			"dialect": "postgresql",
			"queries": {
				"hashC": {
					"name": "ctxQuery",
					"hash": "hashC",
					"template": [{"type": "text", "value": "SELECT 1"}],
					"params": {
						"userId": {"name": "userId", "isContext": true}
					},
					"authorization": []
				}
			}
		}`)

		manifest, err := vexnor.LoadJSON(data)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		q := manifest.Queries["hashC"]
		if q.Params["userId"] == nil {
			t.Fatal("expected param 'userId'")
		}
		if !q.Params["userId"].IsContext {
			t.Error("expected IsContext to be true")
		}
	})
}

func TestLoadJSON_UnsupportedVersion(t *testing.T) {
	t.Run("returns error for version 2", func(t *testing.T) {
		data := []byte(`{
			"version": 2,
			"generatorVersion": "1.0.0",
			"dialect": "postgresql",
			"queries": {}
		}`)

		_, err := vexnor.LoadJSON(data)
		if err == nil {
			t.Fatal("expected error for unsupported version")
		}
		if !errors.Is(err, vexnor.ErrManifestVersion) {
			t.Fatalf("expected ErrManifestVersion, got %v", err)
		}
	})

	t.Run("returns error for version 0", func(t *testing.T) {
		data := []byte(`{
			"version": 0,
			"generatorVersion": "1.0.0",
			"dialect": "postgresql",
			"queries": {}
		}`)

		_, err := vexnor.LoadJSON(data)
		if err == nil {
			t.Fatal("expected error for unsupported version")
		}
		if !errors.Is(err, vexnor.ErrManifestVersion) {
			t.Fatalf("expected ErrManifestVersion, got %v", err)
		}
	})
}

func TestLoadJSON_IncompatibleGeneratorVersion(t *testing.T) {
	t.Run("returns error for major version 2", func(t *testing.T) {
		data := []byte(`{
			"version": 1,
			"generatorVersion": "2.0.0",
			"dialect": "postgresql",
			"queries": {}
		}`)

		_, err := vexnor.LoadJSON(data)
		if err == nil {
			t.Fatal("expected error for incompatible generator version")
		}
		if !errors.Is(err, vexnor.ErrManifestVersion) {
			t.Fatalf("expected ErrManifestVersion, got %v", err)
		}
	})

	t.Run("returns error for major version 0", func(t *testing.T) {
		data := []byte(`{
			"version": 1,
			"generatorVersion": "0.9.0",
			"dialect": "postgresql",
			"queries": {}
		}`)

		_, err := vexnor.LoadJSON(data)
		if err == nil {
			t.Fatal("expected error for incompatible generator version")
		}
		if !errors.Is(err, vexnor.ErrManifestVersion) {
			t.Fatalf("expected ErrManifestVersion, got %v", err)
		}
	})

	t.Run("accepts compatible minor version", func(t *testing.T) {
		data := []byte(`{
			"version": 1,
			"generatorVersion": "1.5.3",
			"dialect": "postgresql",
			"queries": {}
		}`)

		manifest, err := vexnor.LoadJSON(data)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if manifest.GeneratorVersion != "1.5.3" {
			t.Errorf("expected generatorVersion %q, got %q", "1.5.3", manifest.GeneratorVersion)
		}
	})
}

func TestLoadJSON_InvalidJSON(t *testing.T) {
	t.Run("returns error for invalid JSON", func(t *testing.T) {
		data := []byte(`{invalid`)

		_, err := vexnor.LoadJSON(data)
		if err == nil {
			t.Fatal("expected error for invalid JSON")
		}
	})
}

func TestLoadFile(t *testing.T) {
	t.Run("loads manifest from temp file", func(t *testing.T) {
		content := `{
			"version": 1,
			"generatorVersion": "1.0.0",
			"dialect": "postgresql",
			"queries": {
				"fileHash": {
					"name": "fileQuery",
					"hash": "fileHash",
					"template": [{"type": "text", "value": "SELECT 1"}],
					"params": {},
					"authorization": []
				}
			}
		}`

		tmpFile := filepath.Join(t.TempDir(), "manifest.json")
		if err := os.WriteFile(tmpFile, []byte(content), 0644); err != nil {
			t.Fatalf("failed to write temp file: %v", err)
		}

		manifest, err := vexnor.LoadFile(tmpFile)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if manifest == nil {
			t.Fatal("expected non-nil manifest")
		}
		if len(manifest.Queries) != 1 {
			t.Fatalf("expected 1 query, got %d", len(manifest.Queries))
		}
		if manifest.Queries["fileHash"].Name != "fileQuery" {
			t.Errorf("expected name %q, got %q", "fileQuery", manifest.Queries["fileHash"].Name)
		}
	})

	t.Run("returns error for nonexistent file", func(t *testing.T) {
		_, err := vexnor.LoadFile("/nonexistent/path/manifest.json")
		if err == nil {
			t.Fatal("expected error for nonexistent file")
		}
	})
}

func TestLoadDirectory(t *testing.T) {
	t.Run("loads and merges multiple manifest files", func(t *testing.T) {
		dir := t.TempDir()

		manifest1 := `{
			"version": 1,
			"generatorVersion": "1.0.0",
			"dialect": "postgresql",
			"queries": {
				"hash_a": {
					"name": "queryA",
					"hash": "hash_a",
					"template": [{"type": "text", "value": "SELECT 1"}],
					"params": {},
					"authorization": []
				}
			}
		}`

		manifest2 := `{
			"version": 1,
			"generatorVersion": "1.0.0",
			"dialect": "postgresql",
			"queries": {
				"hash_b": {
					"name": "queryB",
					"hash": "hash_b",
					"template": [{"type": "text", "value": "SELECT 2"}],
					"params": {},
					"authorization": ["admin"]
				},
				"hash_c": {
					"name": "queryC",
					"hash": "hash_c",
					"template": [{"type": "text", "value": "SELECT 3"}],
					"params": {},
					"authorization": []
				}
			}
		}`

		if err := os.WriteFile(filepath.Join(dir, "a_manifest.json"), []byte(manifest1), 0644); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "b_manifest.json"), []byte(manifest2), 0644); err != nil {
			t.Fatal(err)
		}

		manifest, err := vexnor.LoadDirectory(dir, "*.json")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(manifest.Queries) != 3 {
			t.Fatalf("expected 3 queries, got %d", len(manifest.Queries))
		}
		if manifest.Queries["hash_a"] == nil {
			t.Error("expected hash_a")
		}
		if manifest.Queries["hash_b"] == nil {
			t.Error("expected hash_b")
		}
		if manifest.Queries["hash_c"] == nil {
			t.Error("expected hash_c")
		}
	})

	t.Run("returns error when no files match", func(t *testing.T) {
		dir := t.TempDir()

		_, err := vexnor.LoadDirectory(dir, "*.json")
		if err == nil {
			t.Fatal("expected error when no files match")
		}
	})

	t.Run("returns error when one file is invalid", func(t *testing.T) {
		dir := t.TempDir()

		validManifest := `{
			"version": 1,
			"generatorVersion": "1.0.0",
			"dialect": "postgresql",
			"queries": {}
		}`
		invalidManifest := `{invalid json`

		if err := os.WriteFile(filepath.Join(dir, "a_valid.json"), []byte(validManifest), 0644); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "b_invalid.json"), []byte(invalidManifest), 0644); err != nil {
			t.Fatal(err)
		}

		_, err := vexnor.LoadDirectory(dir, "*.json")
		if err == nil {
			t.Fatal("expected error for invalid manifest in directory")
		}
	})
}

func TestLoadDirectory_OverrideOnConflict(t *testing.T) {
	t.Run("later file overrides earlier file on hash collision", func(t *testing.T) {
		dir := t.TempDir()

		manifest1 := `{
			"version": 1,
			"generatorVersion": "1.0.0",
			"dialect": "postgresql",
			"queries": {
				"shared_hash": {
					"name": "queryV1",
					"hash": "shared_hash",
					"template": [{"type": "text", "value": "SELECT 'v1'"}],
					"params": {},
					"authorization": []
				}
			}
		}`

		manifest2 := `{
			"version": 1,
			"generatorVersion": "1.0.0",
			"dialect": "postgresql",
			"queries": {
				"shared_hash": {
					"name": "queryV2",
					"hash": "shared_hash",
					"template": [{"type": "text", "value": "SELECT 'v2'"}],
					"params": {},
					"authorization": []
				}
			}
		}`

		// a_ sorts before b_ — so b_ is processed last and wins
		if err := os.WriteFile(filepath.Join(dir, "a_manifest.json"), []byte(manifest1), 0644); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "b_manifest.json"), []byte(manifest2), 0644); err != nil {
			t.Fatal(err)
		}

		manifest, err := vexnor.LoadDirectory(dir, "*.json")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		q := manifest.Queries["shared_hash"]
		if q == nil {
			t.Fatal("expected query at shared_hash")
		}
		// b_ is processed after a_, so queryV2 wins
		if q.Name != "queryV2" {
			t.Errorf("expected name %q (later file wins), got %q", "queryV2", q.Name)
		}
	})
}
