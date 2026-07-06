package vexnor

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

const (
	// SupportedVersion is the manifest schema version this SDK supports.
	SupportedVersion = 1

	// SupportedMajor is the minimum compatible generator semver major version.
	SupportedMajor = 1
)

// LoadJSON deserializes a QueryManifest from raw JSON bytes and validates
// that the manifest version is compatible with this SDK.
func LoadJSON(data []byte) (*QueryManifest, error) {
	var manifest QueryManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("deserialize query manifest: %w", err)
	}

	if err := validateVersion(&manifest); err != nil {
		return nil, err
	}

	return &manifest, nil
}

// LoadFile reads a manifest JSON file from disk and deserializes it.
func LoadFile(path string) (*QueryManifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read manifest file %q: %w", path, err)
	}
	return LoadJSON(data)
}

// LoadDirectory loads all manifest JSON files matching pattern in the given
// directory (recursively) and merges their queries into a single QueryManifest.
// Files are processed in sorted order for deterministic results.
func LoadDirectory(dir, pattern string) (*QueryManifest, error) {
	var matches []string

	err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		matched, matchErr := filepath.Match(pattern, d.Name())
		if matchErr != nil {
			return matchErr
		}
		if matched {
			matches = append(matches, path)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk manifest directory %q: %w", dir, err)
	}

	if len(matches) == 0 {
		return nil, fmt.Errorf("no manifest files found matching %q in %q", pattern, dir)
	}

	sort.Strings(matches)

	var merged *QueryManifest
	for _, path := range matches {
		manifest, err := LoadFile(path)
		if err != nil {
			return nil, fmt.Errorf("load manifest %q: %w", path, err)
		}

		if merged == nil {
			merged = manifest
		} else {
			for hash, query := range manifest.Queries {
				merged.Queries[hash] = query
			}
		}
	}

	return merged, nil
}

// validateVersion checks that the manifest version and generator version
// are compatible with this SDK.
func validateVersion(m *QueryManifest) error {
	if m.Version != SupportedVersion {
		return fmt.Errorf("%w: manifest version %d, SDK supports version %d",
			ErrManifestVersion, m.Version, SupportedVersion)
	}

	if m.GeneratorVersion != "" {
		parts := strings.SplitN(m.GeneratorVersion, ".", 2)
		if len(parts) > 0 {
			major, err := strconv.Atoi(parts[0])
			if err == nil && major != SupportedMajor {
				return fmt.Errorf("%w: generator version %s, SDK supports major version %d.x",
					ErrManifestVersion, m.GeneratorVersion, SupportedMajor)
			}
		}
	}

	return nil
}
