package vexnor

import (
	"fmt"
	"time"
)

// AuthorizeArgs passed to authorization hooks.
type AuthorizeArgs struct {
	Query   *QueryDefinition
	Name    string
	Tags    []string
	Context map[string]any
}

// AuthorizeHook is called before executing queries with authorization tags.
// Return an error to deny execution.
type AuthorizeHook func(args *AuthorizeArgs) error

// QueryPipeline sequences authorization, plugins, and execution.
type QueryPipeline struct {
	plugins   []QueryPipelinePlugin
	authHooks []AuthorizeHook
}

// NewQueryPipeline creates a new empty QueryPipeline.
func NewQueryPipeline() *QueryPipeline {
	return &QueryPipeline{}
}

// Use registers a plugin with the pipeline.
func (p *QueryPipeline) Use(plugin QueryPipelinePlugin) {
	p.plugins = append(p.plugins, plugin)
}

// RegisterAuthorization registers an authorization hook and returns an
// unregister function that removes it.
func (p *QueryPipeline) RegisterAuthorization(hook AuthorizeHook) func() {
	p.authHooks = append(p.authHooks, hook)
	removed := false
	return func() {
		if removed {
			return
		}
		removed = true
		for i, h := range p.authHooks {
			// Compare function pointers via fmt — Go doesn't allow direct func comparison.
			if fmt.Sprintf("%p", h) == fmt.Sprintf("%p", hook) {
				p.authHooks = append(p.authHooks[:i], p.authHooks[i+1:]...)
				return
			}
		}
	}
}

// CheckAuthorization verifies that all queries with authorization tags have at
// least one registered authorization hook. Returns an error listing unprotected
// queries if no hooks are registered.
func (p *QueryPipeline) CheckAuthorization(queries []*QueryDefinition) error {
	if len(p.authHooks) > 0 {
		return nil
	}

	var unprotected []string
	for _, q := range queries {
		if len(q.Authorization) > 0 {
			unprotected = append(unprotected, q.Name)
		}
	}

	if len(unprotected) > 0 {
		return fmt.Errorf("%w: queries with authorization tags but no hooks registered: %v",
			ErrAuthorizationDenied, unprotected)
	}
	return nil
}

// Execute runs the full pipeline lifecycle around a function call.
//
// Lifecycle:
//  1. Init all plugins (catch panics in Init, call OnError)
//  2. If query has Authorization tags, run all authHooks — if any returns error, skip to End
//  3. Check all plugins — if any returns error, skip to End
//  4. Before all plugins (catch panics, call OnError)
//  5. Call fn()
//  6. End all plugins with duration + error
//
// Init/End ALWAYS pair. Before only fires if auth and check pass.
func (p *QueryPipeline) Execute(args *PipelineExecutionArgs, fn func() (any, error)) (any, error) {
	start := time.Now()

	// Phase 1: Init all plugins
	for _, plugin := range p.plugins {
		func() {
			defer func() {
				if r := recover(); r != nil {
					err := fmt.Errorf("plugin %q Init panic: %v", plugin.Name(), r)
					plugin.OnError(err, args)
				}
			}()
			plugin.Init(args)
		}()
	}

	var result any
	var execErr error

	// Phase 2: Authorization
	if args.Query != nil && len(args.Query.Authorization) > 0 {
		for _, hook := range p.authHooks {
			authErr := hook(&AuthorizeArgs{
				Query:   args.Query,
				Name:    args.Name,
				Tags:    args.Query.Authorization,
				Context: args.Context,
			})
			if authErr != nil {
				execErr = fmt.Errorf("%w: %s", ErrAuthorizationDenied, authErr.Error())
				goto end
			}
		}
	}

	// Phase 3: Check all plugins
	for _, plugin := range p.plugins {
		if checkErr := plugin.Check(args); checkErr != nil {
			execErr = checkErr
			goto end
		}
	}

	// Phase 4: Before all plugins
	for _, plugin := range p.plugins {
		func() {
			defer func() {
				if r := recover(); r != nil {
					err := fmt.Errorf("plugin %q Before panic: %v", plugin.Name(), r)
					plugin.OnError(err, args)
				}
			}()
			plugin.Before(args)
		}()
	}

	// Phase 5: Execute
	result, execErr = fn()

end:
	// Phase 6: End all plugins
	durationMs := time.Since(start).Milliseconds()
	endArgs := &PipelineEndArgs{
		Execution:  args,
		DurationMs: durationMs,
		Error:      execErr,
	}
	for _, plugin := range p.plugins {
		plugin.End(endArgs)
	}

	return result, execErr
}
