package vexnor

import (
	"fmt"
	"sync"
	"time"
)

// RateLimiterOptions configures the RateLimiterPlugin.
type RateLimiterOptions struct {
	// Name is the plugin name used in error messages and logging.
	Name string

	// ContextKeyResolver extracts a key from context for per-context limiting.
	// If nil, per-context limiting is disabled.
	ContextKeyResolver func(ctx map[string]any) string

	// MaxConcurrent is the maximum concurrent executions per query hash.
	// 0 means unlimited.
	MaxConcurrent int

	// MaxConcurrentPerContext is the maximum concurrent executions per context key.
	// 0 means unlimited. Requires ContextKeyResolver to be set.
	MaxConcurrentPerContext int

	// ContextTTLMs is the TTL in milliseconds for idle context entries.
	// Defaults to 300000 (5 minutes) if 0.
	ContextTTLMs int64
}

// rateLimiterEntry tracks concurrent execution count and last access time.
type rateLimiterEntry struct {
	count    int
	lastSeen time.Time
}

// RateLimiterPlugin enforces per-query and per-context concurrency limits.
type RateLimiterPlugin struct {
	opts       RateLimiterOptions
	mu         sync.Mutex
	perHash    map[string]*rateLimiterEntry
	perContext map[string]*rateLimiterEntry
}

// NewRateLimiterPlugin creates a new RateLimiterPlugin with the given options.
func NewRateLimiterPlugin(opts RateLimiterOptions) *RateLimiterPlugin {
	if opts.Name == "" {
		opts.Name = "RateLimiter"
	}
	if opts.ContextTTLMs <= 0 {
		opts.ContextTTLMs = 300000
	}
	return &RateLimiterPlugin{
		opts:       opts,
		perHash:    make(map[string]*rateLimiterEntry),
		perContext: make(map[string]*rateLimiterEntry),
	}
}

// Name returns the plugin name.
func (p *RateLimiterPlugin) Name() string {
	return p.opts.Name
}

// Init increments the concurrency counters for the query hash and context key.
func (p *RateLimiterPlugin) Init(args *PipelineExecutionArgs) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Per-hash counter
	entry, ok := p.perHash[args.Hash]
	if !ok {
		entry = &rateLimiterEntry{}
		p.perHash[args.Hash] = entry
	}
	entry.count++
	entry.lastSeen = time.Now()

	// Per-context counter
	if p.opts.ContextKeyResolver != nil && args.Context != nil {
		key := p.opts.ContextKeyResolver(args.Context)
		if key != "" {
			ctxEntry, ok := p.perContext[key]
			if !ok {
				ctxEntry = &rateLimiterEntry{}
				p.perContext[key] = ctxEntry
			}
			ctxEntry.count++
			ctxEntry.lastSeen = time.Now()
		}
	}
}

// Check verifies that concurrency limits are not exceeded.
// Returns ErrRateLimited if a limit is breached.
func (p *RateLimiterPlugin) Check(args *PipelineExecutionArgs) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Check per-hash limit
	if p.opts.MaxConcurrent > 0 {
		if entry, ok := p.perHash[args.Hash]; ok {
			if entry.count > p.opts.MaxConcurrent {
				return fmt.Errorf("%w: query %q exceeds max concurrent limit (%d)",
					ErrRateLimited, args.Name, p.opts.MaxConcurrent)
			}
		}
	}

	// Check per-context limit
	if p.opts.MaxConcurrentPerContext > 0 && p.opts.ContextKeyResolver != nil && args.Context != nil {
		key := p.opts.ContextKeyResolver(args.Context)
		if key != "" {
			if ctxEntry, ok := p.perContext[key]; ok {
				if ctxEntry.count > p.opts.MaxConcurrentPerContext {
					return fmt.Errorf("%w: context %q exceeds max concurrent per-context limit (%d)",
						ErrRateLimited, key, p.opts.MaxConcurrentPerContext)
				}
			}
		}
	}

	return nil
}

// Before is a no-op for the rate limiter.
func (p *RateLimiterPlugin) Before(_ *PipelineExecutionArgs) {}

// End decrements the concurrency counters and cleans up expired entries.
func (p *RateLimiterPlugin) End(args *PipelineEndArgs) {
	p.mu.Lock()
	defer p.mu.Unlock()

	exec := args.Execution

	// Decrement per-hash counter
	if entry, ok := p.perHash[exec.Hash]; ok {
		entry.count--
		if entry.count <= 0 {
			delete(p.perHash, exec.Hash)
		}
	}

	// Decrement per-context counter
	if p.opts.ContextKeyResolver != nil && exec.Context != nil {
		key := p.opts.ContextKeyResolver(exec.Context)
		if key != "" {
			if ctxEntry, ok := p.perContext[key]; ok {
				ctxEntry.count--
				if ctxEntry.count <= 0 {
					delete(p.perContext, key)
				}
			}
		}
	}

	// Opportunistic cleanup of stale entries
	p.cleanupExpired()
}

// OnError is a no-op for the rate limiter.
func (p *RateLimiterPlugin) OnError(_ error, _ *PipelineExecutionArgs) {}

// cleanupExpired removes entries that have been idle longer than ContextTTLMs.
// Must be called with p.mu held.
func (p *RateLimiterPlugin) cleanupExpired() {
	ttl := time.Duration(p.opts.ContextTTLMs) * time.Millisecond
	now := time.Now()

	for key, entry := range p.perContext {
		if entry.count <= 0 && now.Sub(entry.lastSeen) > ttl {
			delete(p.perContext, key)
		}
	}

	for hash, entry := range p.perHash {
		if entry.count <= 0 && now.Sub(entry.lastSeen) > ttl {
			delete(p.perHash, hash)
		}
	}
}
