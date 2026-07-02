package vexnor

import (
	"fmt"
	"strings"
)

// QueryInfo represents basic metadata about a registered query.
type QueryInfo struct {
	Hash string
	Name string
}

// QueryRegistry loads and resolves portable queries from manifests.
type QueryRegistry struct {
	queries  map[string]*QueryDefinition
	dialect  string
	pipeline *QueryPipeline
}

// NewQueryRegistry creates a new QueryRegistry for the given SQL dialect.
// Supported dialects: "postgresql", "transactsql", "sqlite".
func NewQueryRegistry(dialect string) *QueryRegistry {
	return &QueryRegistry{
		queries:  make(map[string]*QueryDefinition),
		dialect:  dialect,
		pipeline: NewQueryPipeline(),
	}
}

// Use registers a plugin with the registry's pipeline.
func (r *QueryRegistry) Use(plugin QueryPipelinePlugin) {
	r.pipeline.Use(plugin)
}

// RegisterAuthorization registers an authorization hook with the registry's
// pipeline and returns an unregister function.
func (r *QueryRegistry) RegisterAuthorization(hook AuthorizeHook) func() {
	return r.pipeline.RegisterAuthorization(hook)
}

// CheckAuthorization verifies that all queries with authorization tags have at
// least one registered authorization hook. Returns an error if any tagged
// queries are unprotected.
func (r *QueryRegistry) CheckAuthorization() error {
	queries := make([]*QueryDefinition, 0, len(r.queries))
	for _, q := range r.queries {
		queries = append(queries, q)
	}
	return r.pipeline.CheckAuthorization(queries)
}

// GetAuthorizedQueries returns all registered queries that have authorization tags.
func (r *QueryRegistry) GetAuthorizedQueries() []*QueryDefinition {
	var result []*QueryDefinition
	for _, q := range r.queries {
		if len(q.Authorization) > 0 {
			result = append(result, q)
		}
	}
	return result
}

// GetUnauthorizedQueries returns all registered queries that do NOT have
// authorization tags.
func (r *QueryRegistry) GetUnauthorizedQueries() []*QueryDefinition {
	var result []*QueryDefinition
	for _, q := range r.queries {
		if len(q.Authorization) == 0 {
			result = append(result, q)
		}
	}
	return result
}

// Load merges all queries from a manifest into the registry.
func (r *QueryRegistry) Load(manifest *QueryManifest) {
	for hash, query := range manifest.Queries {
		// Ensure the hash is set on the definition itself.
		if query.Hash == "" {
			query.Hash = hash
		}
		r.queries[hash] = query
	}
}

// LoadFile reads a manifest JSON file from disk and loads its queries.
func (r *QueryRegistry) LoadFile(path string) error {
	manifest, err := LoadFile(path)
	if err != nil {
		return err
	}
	r.Load(manifest)
	return nil
}

// LoadDirectory loads all manifest JSON files matching pattern in the given
// directory and merges their queries into the registry.
func (r *QueryRegistry) LoadDirectory(dir, pattern string) error {
	manifest, err := LoadDirectory(dir, pattern)
	if err != nil {
		return err
	}
	r.Load(manifest)
	return nil
}

// Build resolves a query by hash, injects context parameters, validates
// params, and builds the SQL text + values.
func (r *QueryRegistry) Build(hash string, params map[string]any) (*SqlBuildResult, error) {
	query, ok := r.queries[hash]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrUnknownQuery, hash)
	}

	builder := NewSqlBuilder(r.dialect)
	return builder.Build(query, params)
}

// Execute resolves a query by hash, runs it through the pipeline with
// authorization and plugins, and invokes execFn with the built SQL.
func (r *QueryRegistry) Execute(hash string, params, context map[string]any, execFn func(*SqlBuildResult) (any, error)) (any, error) {
	query, ok := r.queries[hash]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrUnknownQuery, hash)
	}

	// Inject context values into params
	resolvedParams, err := r.injectContext(query, params, context)
	if err != nil {
		return nil, err
	}

	// Validate params
	if err := r.validateParams(query, resolvedParams); err != nil {
		return nil, err
	}

	// Build pipeline args
	pipelineArgs := &PipelineExecutionArgs{
		Hash:     hash,
		Name:     query.Name,
		Location: query.Location,
		Query:    query,
		Params:   resolvedParams,
		Context:  context,
	}

	// Execute through pipeline
	return r.pipeline.Execute(pipelineArgs, func() (any, error) {
		buildResult, err := NewSqlBuilder(r.dialect).Build(query, resolvedParams)
		if err != nil {
			return nil, err
		}
		return execFn(buildResult)
	})
}

// injectContext replaces context-sourced params with values from the context map.
// For each param where IsContext == true, the value is pulled from the context map.
// Returns an error if a required context value is missing.
func (r *QueryRegistry) injectContext(query *QueryDefinition, params, context map[string]any) (map[string]any, error) {
	if len(query.Params) == 0 {
		return params, nil
	}

	// Create a copy of params to avoid mutating the caller's map.
	resolved := make(map[string]any, len(params))
	for k, v := range params {
		resolved[k] = v
	}

	for name, paramDef := range query.Params {
		if !paramDef.IsContext {
			continue
		}

		val, exists := context[name]
		if !exists || val == nil {
			// Check if optional
			if paramDef.Optional != nil && *paramDef.Optional {
				continue
			}
			return nil, fmt.Errorf("%w: %q", ErrContextMissing, name)
		}
		resolved[name] = val
	}

	return resolved, nil
}

// validateParams validates parameters that have a Validation schema defined.
// Currently validates "filter" (columns + operators) and "projection" (columns + functions).
func (r *QueryRegistry) validateParams(query *QueryDefinition, params map[string]any) error {
	for name, paramDef := range query.Params {
		if paramDef.Validation == nil {
			continue
		}

		val, exists := params[name]
		if !exists || val == nil {
			continue
		}

		switch paramDef.Validation.Type {
		case "filter":
			if err := r.validateFilter(paramDef.Validation, val); err != nil {
				return fmt.Errorf("%w: param %q: %s", ErrValidation, name, err.Error())
			}
		case "projection":
			if err := r.validateProjection(paramDef.Validation, val); err != nil {
				return fmt.Errorf("%w: param %q: %s", ErrValidation, name, err.Error())
			}
		}
	}
	return nil
}

// validateFilter validates a filter parameter value against the schema.
func (r *QueryRegistry) validateFilter(schema *ParamValidationSchema, value any) error {
	allowedCols := make(map[string]bool, len(schema.Columns))
	for _, col := range schema.Columns {
		allowedCols[col] = true
	}

	allowedOps := make(map[string]bool, len(schema.Operators))
	for _, op := range schema.Operators {
		allowedOps[op] = true
	}

	var conditions []map[string]any
	switch v := value.(type) {
	case []any:
		for _, item := range v {
			if m, ok := item.(map[string]any); ok {
				conditions = append(conditions, m)
			}
		}
	case map[string]any:
		conditions = append(conditions, v)
	default:
		return nil
	}

	return r.validateFilterConditions(conditions, allowedCols, allowedOps)
}

// validateFilterConditions recursively validates filter conditions.
func (r *QueryRegistry) validateFilterConditions(conditions []map[string]any, allowedCols, allowedOps map[string]bool) error {
	for _, cond := range conditions {
		for key, val := range cond {
			if key == "or" {
				// Recurse into OR group
				if orArr, ok := val.([]any); ok {
					var orConditions []map[string]any
					for _, item := range orArr {
						if m, ok := item.(map[string]any); ok {
							orConditions = append(orConditions, m)
						}
					}
					if err := r.validateFilterConditions(orConditions, allowedCols, allowedOps); err != nil {
						return err
					}
				}
				continue
			}

			if !allowedCols[key] {
				return fmt.Errorf("invalid column %q, allowed: %s", key, strings.Join(mapKeys(allowedCols), ", "))
			}

			// Validate operator if present
			if tuple, ok := val.([]any); ok && len(tuple) >= 1 {
				if op, ok := tuple[0].(string); ok {
					if len(allowedOps) > 0 && !allowedOps[op] {
						return fmt.Errorf("invalid operator %q for column %q, allowed: %s", op, key, strings.Join(mapKeys(allowedOps), ", "))
					}
				}
			}
		}
	}
	return nil
}

// validateProjection validates a projection parameter value against the schema.
func (r *QueryRegistry) validateProjection(schema *ParamValidationSchema, value any) error {
	allowedCols := make(map[string]bool, len(schema.Columns))
	for _, col := range schema.Columns {
		allowedCols[col] = true
	}

	allowedFns := make(map[string]bool, len(schema.Functions))
	for _, fn := range schema.Functions {
		allowedFns[fn] = true
	}

	entries, ok := value.([]any)
	if !ok {
		return nil
	}

	for _, entry := range entries {
		switch e := entry.(type) {
		case string:
			if !allowedCols[e] {
				return fmt.Errorf("invalid projection column %q, allowed: %s", e, strings.Join(mapKeys(allowedCols), ", "))
			}
		case []any:
			// Aggregate: [fn, colRef, alias]
			if len(e) < 3 {
				continue
			}
			if fn, ok := e[0].(string); ok {
				if len(allowedFns) > 0 && !allowedFns[fn] {
					return fmt.Errorf("invalid aggregate function %q, allowed: %s", fn, strings.Join(mapKeys(allowedFns), ", "))
				}
			}
			if colRef, ok := e[1].(string); ok && colRef != "*" {
				if !allowedCols[colRef] {
					return fmt.Errorf("invalid projection column %q in aggregate, allowed: %s", colRef, strings.Join(mapKeys(allowedCols), ", "))
				}
			}
		}
	}
	return nil
}

// GetRegisteredHashes returns all registered query hashes.
func (r *QueryRegistry) GetRegisteredHashes() []string {
	hashes := make([]string, 0, len(r.queries))
	for hash := range r.queries {
		hashes = append(hashes, hash)
	}
	return hashes
}

// GetQuery returns the query definition for a given hash, or nil if not found.
func (r *QueryRegistry) GetQuery(hash string) *QueryDefinition {
	return r.queries[hash]
}

// GetRegisteredQueries returns basic metadata for all registered queries.
func (r *QueryRegistry) GetRegisteredQueries() []QueryInfo {
	result := make([]QueryInfo, 0, len(r.queries))
	for hash, query := range r.queries {
		result = append(result, QueryInfo{
			Hash: hash,
			Name: query.Name,
		})
	}
	return result
}

// mapKeys returns the keys of a map[string]bool as a sorted slice.
func mapKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
