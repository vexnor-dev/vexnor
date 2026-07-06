package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	vexnor "github.com/vexnor-dev/vexnor-go/vexnor"

	vexnorMssql "github.com/vexnor-dev/vexnor-go/mssql"
	vexnorPostgres "github.com/vexnor-dev/vexnor-go/postgres"
	vexnorSqlite3 "github.com/vexnor-dev/vexnor-go/sqlite3"
)

// dialectConfig maps the short name to its SQL dialect identifier and manifest subdirectory.
type dialectConfig struct {
	Name    string // e.g. "postgres", "mssql", "sqlite3"
	Dialect string // e.g. "postgresql", "transactsql", "sqlite"
}

var dialects = []dialectConfig{
	{Name: "postgres", Dialect: "postgresql"},
	{Name: "mssql", Dialect: "transactsql"},
	{Name: "sqlite3", Dialect: "sqlite"},
}

func main() {
	ctx := context.Background()

	// ─── Manifest loading ────────────────────────────────────────────────────────
	manifestDir := os.Getenv("VEXNOR_MANIFEST_DIR")
	if manifestDir == "" {
		manifestDir = filepath.Join("..", "..", "fixtures", "manifests")
	}
	manifestDir, _ = filepath.Abs(manifestDir)

	registries := make(map[string]*vexnor.QueryRegistry, len(dialects))
	for _, d := range dialects {
		registry := vexnor.NewQueryRegistry(d.Dialect)
		dir := filepath.Join(manifestDir, d.Name)

		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			if err := registry.LoadDirectory(dir, "*.json"); err != nil {
				log.Printf("  [%s] WARNING: Failed to load manifests from %s: %v", d.Name, dir, err)
			} else {
				log.Printf("  [%s] Loaded %d queries from %s", d.Name, len(registry.GetRegisteredHashes()), dir)
			}
		} else {
			log.Printf("  [%s] WARNING: Manifest directory not found: %s", d.Name, dir)
		}

		registries[d.Name] = registry
	}

	// ─── Executors ───────────────────────────────────────────────────────────────
	executors := make(map[string]vexnor.Executor, 3)

	// PostgreSQL
	pgHost := envOr("POSTGRES_HOST", "localhost")
	pgPort := envOr("POSTGRES_PORT", "5432")
	pgUser := envOr("POSTGRES_USER", "postgres")
	pgPass := envOr("POSTGRES_PASSWORD", "postgres")
	pgDB := envOr("POSTGRES_DATABASE", "postgres")
	pgConnStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s", pgUser, pgPass, pgHost, pgPort, pgDB)

	pgExecutor, err := vexnorPostgres.NewFromConnString(ctx, pgConnStr)
	if err != nil {
		log.Printf("  [postgres] WARNING: Failed to connect: %v", err)
	} else {
		executors["postgres"] = pgExecutor
		defer pgExecutor.Close()
		log.Printf("  [postgres] Connected to %s:%s/%s", pgHost, pgPort, pgDB)
	}

	// MSSQL
	mssqlHost := envOr("MSSQL_HOST", "localhost")
	mssqlPort := envOr("MSSQL_PORT", "1433")
	mssqlUser := envOr("MSSQL_USER", "vexnor_dev")
	mssqlPass := envOr("MSSQL_PASSWORD", "P@ssw0rd!")
	mssqlDB := envOr("MSSQL_DATABASE", "vexnor")
	mssqlConnStr := fmt.Sprintf("sqlserver://%s:%s@%s:%s?database=%s&TrustServerCertificate=true",
		mssqlUser, mssqlPass, mssqlHost, mssqlPort, mssqlDB)

	mssqlExecutor, err := vexnorMssql.NewFromConnString(mssqlConnStr)
	if err != nil {
		log.Printf("  [mssql] WARNING: Failed to connect: %v", err)
	} else {
		executors["mssql"] = mssqlExecutor
		defer mssqlExecutor.Close()
		log.Printf("  [mssql] Connected to %s:%s/%s", mssqlHost, mssqlPort, mssqlDB)
	}

	// SQLite
	sqlitePath := envOr("SQLITE_PATH", filepath.Join("..", "..", "fixtures", "vexnor.db"))
	if !filepath.IsAbs(sqlitePath) {
		sqlitePath, _ = filepath.Abs(sqlitePath)
	}

	sqliteExecutor, err := vexnorSqlite3.NewFromPath(sqlitePath)
	if err != nil {
		log.Printf("  [sqlite3] WARNING: Failed to open database: %v", err)
	} else {
		executors["sqlite3"] = sqliteExecutor
		defer sqliteExecutor.Close()
		log.Printf("  [sqlite3] Opened %s", sqlitePath)
	}

	// ─── Router ──────────────────────────────────────────────────────────────────
	r := chi.NewRouter()

	// Middleware
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(requestLogger)
	r.Use(middleware.Recoverer)

	// ─── Endpoints ───────────────────────────────────────────────────────────────

	r.Get("/api/health", func(w http.ResponseWriter, _ *http.Request) {
		queries := make(map[string]int, len(registries))
		for name, reg := range registries {
			queries[name] = len(reg.GetRegisteredHashes())
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"status":  "ok",
			"queries": queries,
		})
	})

	r.Post("/api/db", func(w http.ResponseWriter, req *http.Request) {
		var body struct {
			Hash    string         `json:"hash"`
			Params  map[string]any `json:"params"`
			Context map[string]any `json:"context"`
			Backend string         `json:"backend"`
			Plugin  string         `json:"plugin"`
			Name    string         `json:"name"`
			Mode    string         `json:"mode"`
		}

		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON: " + err.Error()})
			return
		}

		// Resolve backend from plugin name or explicit backend field
		backend := body.Backend
		if backend == "" && body.Plugin != "" {
			backend = pluginToBackend(body.Plugin)
		}
		if backend == "" {
			backend = "postgres"
		}
		if body.Params == nil {
			body.Params = make(map[string]any)
		}
		if body.Context == nil {
			body.Context = make(map[string]any)
		}

		// Decode userId from Authorization header (JWT) and inject into context
		authHeader := req.Header.Get("Authorization")
		token := strings.TrimPrefix(authHeader, "Bearer ")
		if userId := decodeUserId(token); userId != "" {
			body.Context["userId"] = userId
		}

		registry, ok := registries[backend]
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("Unknown backend: %s", backend)})
			return
		}

		executor, ok := executors[backend]
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": fmt.Sprintf("No executor configured for: %s", backend)})
			return
		}

		result, err := registry.Execute(body.Hash, body.Params, body.Context, func(sql *vexnor.SqlBuildResult) (any, error) {
			return executor.QueryRows(req.Context(), sql)
		})
		if err != nil {
			switch {
			case errors.Is(err, vexnor.ErrUnknownQuery):
				writeJSON(w, http.StatusNotFound, map[string]string{"error": fmt.Sprintf("Unknown query hash: %s", body.Hash)})
			case errors.Is(err, vexnor.ErrContextMissing):
				writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			case errors.Is(err, vexnor.ErrAuthorizationDenied):
				writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			default:
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			return
		}

		writeJSON(w, http.StatusOK, result)
	})

	// ─── Start server ────────────────────────────────────────────────────────────
	port := envOr("GO_EXAMPLE_PORT", "5001")
	addr := ":" + port
	log.Printf("Starting server on http://localhost%s", addr)

	server := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("Server failed: %v", err)
	}
}

// writeJSON encodes v as JSON and writes it to w with the given status code.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("Failed to encode JSON response: %v", err)
	}
}

// requestLogger is a simple request logging middleware.
func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, ww.Status(), time.Since(start).Round(time.Millisecond))
	})
}

// pluginToBackend maps @vexnor/plugin names to backend names.
func pluginToBackend(plugin string) string {
	switch plugin {
	case "@vexnor/postgres":
		return "postgres"
	case "@vexnor/mssql":
		return "mssql"
	case "@vexnor/sqlite3":
		return "sqlite3"
	default:
		return ""
	}
}

// decodeUserId extracts the "sub" claim from a JWT token without verification.
// This matches the Node.js/Hono backend behavior — the token is trusted (demo app).
func decodeUserId(token string) string {
	if token == "" {
		return ""
	}
	parts := strings.Split(token, ".")
	if len(parts) < 2 {
		return ""
	}
	// Decode the payload (second part), handle both padded and unpadded base64
	payload := parts[1]
	// Add padding if needed
	switch len(payload) % 4 {
	case 2:
		payload += "=="
	case 3:
		payload += "="
	}
	decoded, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		// Try standard encoding
		decoded, err = base64.StdEncoding.DecodeString(payload)
		if err != nil {
			return ""
		}
	}
	var claims struct {
		Sub string `json:"sub"`
	}
	if err := json.Unmarshal(decoded, &claims); err != nil {
		return ""
	}
	return claims.Sub
}

// envOr returns the value of the environment variable key, or fallback if unset/empty.
func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
