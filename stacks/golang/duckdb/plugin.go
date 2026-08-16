package duckdb

import (
	"fmt"
	"net/url"
	"strings"
)

// ConnectionConfig selects an in-memory, file-backed, MotherDuck, or raw URI connection.
type ConnectionConfig struct {
	Mode     string
	Path     string
	Database string
	Token    string
	URI      string
}

// Open creates an executor from a portable DuckDB connection configuration.
func Open(config ConnectionConfig) (*Executor, error) {
	path, err := resolveConnectionPath(config)
	if err != nil {
		return nil, err
	}
	return newExecutor(path)
}

func resolveConnectionPath(config ConnectionConfig) (string, error) {
	if config.URI != "" {
		return config.URI, nil
	}
	switch config.Mode {
	case "memory":
		return ":memory:", nil
	case "file":
		if strings.TrimSpace(config.Path) == "" {
			return "", fmt.Errorf("duckdb: file path must not be empty")
		}
		return config.Path, nil
	case "motherduck":
		if strings.TrimSpace(config.Database) == "" {
			return "", fmt.Errorf("duckdb: MotherDuck database must not be empty")
		}
		if strings.TrimSpace(config.Token) == "" {
			return "", fmt.Errorf("duckdb: MotherDuck token must not be empty")
		}
		return "md:" + config.Database + "?motherduck_token=" + url.QueryEscape(config.Token), nil
	default:
		return "", fmt.Errorf("duckdb: unsupported connection mode %q", config.Mode)
	}
}
