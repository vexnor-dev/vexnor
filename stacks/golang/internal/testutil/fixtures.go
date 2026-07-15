package testutil

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
)

// FixturesDir returns the absolute path to stacks/fixtures/manifests/cross-runtime/
func FixturesDir() string {
	// Walk up from this file to find stacks/fixtures
	_, filename, _, _ := runtime.Caller(0)
	base := filepath.Dir(filename)
	return filepath.Join(base, "..", "..", "..", "fixtures", "manifests", "cross-runtime")
}

// ExpectedResult matches the JSON format of expected.json entries.
type ExpectedResult struct {
	Hash   string          `json:"hash"`
	Text   *string         `json:"text"`   // nil on error cases
	Values []any           `json:"values"` // nil on error cases
	Params json.RawMessage `json:"params"`
	Error  *string         `json:"error"` // nil on success
}

// LoadExpected loads expected.json and returns map[testName]*ExpectedResult.
func LoadExpected() (map[string]*ExpectedResult, error) {
	path := filepath.Join(FixturesDir(), "expected.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var result map[string]*ExpectedResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// LoadManifestPath returns the path to manifest.json.
func LoadManifestPath() string {
	return filepath.Join(FixturesDir(), "manifest.json")
}
