package vexnor_test

import (
	"errors"
	"sync"
	"testing"

	"github.com/vexnor-dev/vexnor-go/vexnor"
)

// --- RateLimiterPlugin Tests ---

func TestRateLimiterPlugin_UnderLimit(t *testing.T) {
	t.Run("does not reject when under limit", func(t *testing.T) {
		plugin := vexnor.NewRateLimiterPlugin(vexnor.RateLimiterOptions{
			MaxConcurrent: 10,
			ContextKeyResolver: func(ctx map[string]any) string {
				if v, ok := ctx["userId"]; ok {
					return v.(string)
				}
				return ""
			},
			MaxConcurrentPerContext: 5,
		})

		args := &vexnor.PipelineExecutionArgs{
			Hash:    "hash1",
			Name:    "testQuery",
			Context: map[string]any{"userId": "user-1"},
		}

		plugin.Init(args)
		err := plugin.Check(args)
		if err != nil {
			t.Fatalf("unexpected rejection: %v", err)
		}

		plugin.End(&vexnor.PipelineEndArgs{Execution: args})
	})
}

func TestRateLimiterPlugin_MaxConcurrentExceeded(t *testing.T) {
	t.Run("rejects when MaxConcurrent exceeded", func(t *testing.T) {
		plugin := vexnor.NewRateLimiterPlugin(vexnor.RateLimiterOptions{
			MaxConcurrent: 2,
		})

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		// Init 3 times to exceed limit of 2
		plugin.Init(args)
		plugin.Init(args)
		plugin.Init(args)

		err := plugin.Check(args)
		if err == nil {
			t.Fatal("expected rate limit error")
		}
		if !errors.Is(err, vexnor.ErrRateLimited) {
			t.Fatalf("expected ErrRateLimited, got %v", err)
		}
	})
}

func TestRateLimiterPlugin_MaxConcurrentPerContextExceeded(t *testing.T) {
	t.Run("rejects when MaxConcurrentPerContext exceeded", func(t *testing.T) {
		plugin := vexnor.NewRateLimiterPlugin(vexnor.RateLimiterOptions{
			MaxConcurrent: 100,
			ContextKeyResolver: func(ctx map[string]any) string {
				if v, ok := ctx["userId"]; ok {
					return v.(string)
				}
				return ""
			},
			MaxConcurrentPerContext: 2,
		})

		args := &vexnor.PipelineExecutionArgs{
			Hash:    "hash1",
			Name:    "testQuery",
			Context: map[string]any{"userId": "user-1"},
		}

		// Init 3 times for same context to exceed per-context limit of 2
		plugin.Init(args)
		plugin.Init(args)
		plugin.Init(args)

		err := plugin.Check(args)
		if err == nil {
			t.Fatal("expected rate limit error")
		}
		if !errors.Is(err, vexnor.ErrRateLimited) {
			t.Fatalf("expected ErrRateLimited, got %v", err)
		}

		// Different user should not be limited
		args2 := &vexnor.PipelineExecutionArgs{
			Hash:    "hash1",
			Name:    "testQuery",
			Context: map[string]any{"userId": "user-2"},
		}
		plugin.Init(args2)
		err = plugin.Check(args2)
		if err != nil {
			t.Fatalf("unexpected rejection for different user: %v", err)
		}
	})
}

func TestRateLimiterPlugin_DecrementsOnEnd(t *testing.T) {
	t.Run("decrements counter on End allowing new executions", func(t *testing.T) {
		plugin := vexnor.NewRateLimiterPlugin(vexnor.RateLimiterOptions{
			MaxConcurrent: 2,
		})

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		// Init 2 times (at limit)
		plugin.Init(args)
		plugin.Init(args)

		// Check should pass (at limit, not over)
		err := plugin.Check(args)
		if err != nil {
			t.Fatalf("unexpected rejection at limit: %v", err)
		}

		// End one
		plugin.End(&vexnor.PipelineEndArgs{Execution: args})

		// Init again (back to 2)
		plugin.Init(args)

		// Should still pass at limit
		err = plugin.Check(args)
		if err != nil {
			t.Fatalf("unexpected rejection after End: %v", err)
		}
	})
}

func TestRateLimiterPlugin_ConcurrentAccess(t *testing.T) {
	t.Run("handles concurrent Init/End safely", func(t *testing.T) {
		plugin := vexnor.NewRateLimiterPlugin(vexnor.RateLimiterOptions{
			MaxConcurrent: 100,
			ContextKeyResolver: func(ctx map[string]any) string {
				if v, ok := ctx["userId"]; ok {
					return v.(string)
				}
				return ""
			},
			MaxConcurrentPerContext: 50,
		})

		var wg sync.WaitGroup
		for i := 0; i < 50; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				args := &vexnor.PipelineExecutionArgs{
					Hash:    "hash1",
					Name:    "testQuery",
					Context: map[string]any{"userId": "user-1"},
				}
				plugin.Init(args)
				_ = plugin.Check(args)
				plugin.End(&vexnor.PipelineEndArgs{Execution: args})
			}()
		}
		wg.Wait()
	})
}

// --- AuditLogPlugin Tests ---

func TestAuditLogPlugin_FiresOnLog(t *testing.T) {
	t.Run("fires OnLog in End with correct fields", func(t *testing.T) {
		var captured *vexnor.AuditLogEntry
		plugin := vexnor.NewAuditLogPlugin(vexnor.AuditLogOptions{
			OnLog: func(entry *vexnor.AuditLogEntry) {
				captured = entry
			},
		})

		execArgs := &vexnor.PipelineExecutionArgs{
			Hash:     "hash1",
			Name:     "testQuery",
			Location: "src/test.ts:5",
			Context:  map[string]any{"userId": "u1"},
		}

		plugin.Init(execArgs)
		plugin.End(&vexnor.PipelineEndArgs{
			Execution:  execArgs,
			DurationMs: 42,
			Error:      nil,
		})

		if captured == nil {
			t.Fatal("expected OnLog to be called")
		}
		if captured.Name != "testQuery" {
			t.Errorf("expected Name %q, got %q", "testQuery", captured.Name)
		}
		if captured.Hash != "hash1" {
			t.Errorf("expected Hash %q, got %q", "hash1", captured.Hash)
		}
		if captured.Location != "src/test.ts:5" {
			t.Errorf("expected Location %q, got %q", "src/test.ts:5", captured.Location)
		}
		if captured.DurationMs != 42 {
			t.Errorf("expected DurationMs %d, got %d", 42, captured.DurationMs)
		}
		if captured.Error != "" {
			t.Errorf("expected empty Error, got %q", captured.Error)
		}
	})
}

func TestAuditLogPlugin_ContextLogResolver(t *testing.T) {
	t.Run("includes projected context from ContextLogResolver", func(t *testing.T) {
		var captured *vexnor.AuditLogEntry
		plugin := vexnor.NewAuditLogPlugin(vexnor.AuditLogOptions{
			ContextLogResolver: func(ctx map[string]any) map[string]any {
				return map[string]any{"userId": ctx["userId"]}
			},
			OnLog: func(entry *vexnor.AuditLogEntry) {
				captured = entry
			},
		})

		execArgs := &vexnor.PipelineExecutionArgs{
			Hash:     "hash1",
			Name:     "testQuery",
			Location: "src/test.ts:5",
			Context:  map[string]any{"userId": "u1", "secret": "do-not-log"},
		}

		plugin.End(&vexnor.PipelineEndArgs{
			Execution:  execArgs,
			DurationMs: 10,
		})

		if captured == nil {
			t.Fatal("expected OnLog to be called")
		}
		if captured.Context == nil {
			t.Fatal("expected context in log entry")
		}
		if captured.Context["userId"] != "u1" {
			t.Errorf("expected userId %q, got %v", "u1", captured.Context["userId"])
		}
		if _, hasSecret := captured.Context["secret"]; hasSecret {
			t.Error("secret should not be in logged context")
		}
	})

	t.Run("context is nil when no resolver", func(t *testing.T) {
		var captured *vexnor.AuditLogEntry
		plugin := vexnor.NewAuditLogPlugin(vexnor.AuditLogOptions{
			OnLog: func(entry *vexnor.AuditLogEntry) {
				captured = entry
			},
		})

		execArgs := &vexnor.PipelineExecutionArgs{
			Hash:    "hash1",
			Name:    "testQuery",
			Context: map[string]any{"userId": "u1"},
		}

		plugin.End(&vexnor.PipelineEndArgs{
			Execution:  execArgs,
			DurationMs: 5,
		})

		if captured == nil {
			t.Fatal("expected OnLog to be called")
		}
		if captured.Context != nil {
			t.Errorf("expected nil context, got %v", captured.Context)
		}
	})
}

func TestAuditLogPlugin_IncludesError(t *testing.T) {
	t.Run("includes error message on failure", func(t *testing.T) {
		var captured *vexnor.AuditLogEntry
		plugin := vexnor.NewAuditLogPlugin(vexnor.AuditLogOptions{
			OnLog: func(entry *vexnor.AuditLogEntry) {
				captured = entry
			},
		})

		execArgs := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		plugin.End(&vexnor.PipelineEndArgs{
			Execution:  execArgs,
			DurationMs: 100,
			Error:      errors.New("connection timeout"),
		})

		if captured == nil {
			t.Fatal("expected OnLog to be called")
		}
		if captured.Error != "connection timeout" {
			t.Fatalf("expected Error %q, got %q", "connection timeout", captured.Error)
		}
	})
}

func TestAuditLogPlugin_NoOnLog(t *testing.T) {
	t.Run("does not panic when OnLog is nil", func(t *testing.T) {
		plugin := vexnor.NewAuditLogPlugin(vexnor.AuditLogOptions{})

		execArgs := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		// Should not panic
		plugin.End(&vexnor.PipelineEndArgs{
			Execution:  execArgs,
			DurationMs: 10,
		})
	})
}

// --- OpenTelemetryPlugin Tests ---

// mockSpan records calls for testing.
type mockSpan struct {
	mu         sync.Mutex
	attrs      map[string]string
	errors     []error
	ended      bool
}

func newMockSpan() *mockSpan {
	return &mockSpan{attrs: make(map[string]string)}
}

func (s *mockSpan) SetAttribute(key, value string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.attrs[key] = value
}
func (s *mockSpan) SetError(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.errors = append(s.errors, err)
}
func (s *mockSpan) End() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ended = true
}

// mockTracer creates mockSpan instances and records them for inspection.
type mockTracer struct {
	mu    sync.Mutex
	spans []*mockSpan
}

func newMockTracer() *mockTracer {
	return &mockTracer{}
}

func (t *mockTracer) Start(name string, attrs map[string]string) vexnor.Span {
	span := newMockSpan()
	for k, v := range attrs {
		span.attrs[k] = v
	}
	span.attrs["_spanName"] = name
	t.mu.Lock()
	defer t.mu.Unlock()
	t.spans = append(t.spans, span)
	return span
}

func TestOpenTelemetryPlugin_CreatesSpanOnInit(t *testing.T) {
	t.Run("creates span on Init", func(t *testing.T) {
		tracer := newMockTracer()
		plugin := vexnor.NewOpenTelemetryPlugin(tracer)

		args := &vexnor.PipelineExecutionArgs{
			Hash:     "hash1",
			Name:     "testQuery",
			Location: "src/test.ts:1",
		}

		plugin.Init(args)

		if len(tracer.spans) != 1 {
			t.Fatalf("expected 1 span, got %d", len(tracer.spans))
		}

		span := tracer.spans[0]
		if span.attrs["_spanName"] != "testQuery" {
			t.Errorf("expected span name %q, got %q", "testQuery", span.attrs["_spanName"])
		}
		if span.attrs["db.vexnor.hash"] != "hash1" {
			t.Errorf("expected hash %q, got %q", "hash1", span.attrs["db.vexnor.hash"])
		}
		if span.attrs["db.vexnor.location"] != "src/test.ts:1" {
			t.Errorf("expected location %q, got %q", "src/test.ts:1", span.attrs["db.vexnor.location"])
		}
	})
}

func TestOpenTelemetryPlugin_EndsSpanOnEnd(t *testing.T) {
	t.Run("ends span on End", func(t *testing.T) {
		tracer := newMockTracer()
		plugin := vexnor.NewOpenTelemetryPlugin(tracer)

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		plugin.Init(args)
		plugin.End(&vexnor.PipelineEndArgs{
			Execution:  args,
			DurationMs: 15,
		})

		span := tracer.spans[0]
		if !span.ended {
			t.Fatal("expected span to be ended")
		}
		if span.attrs["db.vexnor.duration_ms"] != "15" {
			t.Errorf("expected duration_ms %q, got %q", "15", span.attrs["db.vexnor.duration_ms"])
		}
	})
}

func TestOpenTelemetryPlugin_SetsErrorOnSpan(t *testing.T) {
	t.Run("sets error on span when execution fails", func(t *testing.T) {
		tracer := newMockTracer()
		plugin := vexnor.NewOpenTelemetryPlugin(tracer)

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		plugin.Init(args)

		execErr := errors.New("query failed")
		plugin.End(&vexnor.PipelineEndArgs{
			Execution:  args,
			DurationMs: 5,
			Error:      execErr,
		})

		span := tracer.spans[0]
		if len(span.errors) != 1 {
			t.Fatalf("expected 1 error on span, got %d", len(span.errors))
		}
		if span.errors[0].Error() != "query failed" {
			t.Errorf("expected error %q, got %q", "query failed", span.errors[0].Error())
		}
		if !span.ended {
			t.Fatal("expected span to be ended")
		}
	})
}

func TestOpenTelemetryPlugin_NoopTracer(t *testing.T) {
	t.Run("uses NoopTracer without panicking", func(t *testing.T) {
		tracer := vexnor.NoopTracer{}
		plugin := vexnor.NewOpenTelemetryPlugin(tracer)

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		// Should not panic
		plugin.Init(args)
		_ = plugin.Check(args)
		plugin.Before(args)
		plugin.End(&vexnor.PipelineEndArgs{
			Execution:  args,
			DurationMs: 10,
			Error:      errors.New("some error"),
		})
	})
}

func TestOpenTelemetryPlugin_OnError(t *testing.T) {
	t.Run("records error via OnError", func(t *testing.T) {
		tracer := newMockTracer()
		plugin := vexnor.NewOpenTelemetryPlugin(tracer)

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		plugin.Init(args)
		plugin.OnError(errors.New("plugin panic"), args)

		span := tracer.spans[0]
		if len(span.errors) != 1 {
			t.Fatalf("expected 1 error on span, got %d", len(span.errors))
		}
		if span.errors[0].Error() != "plugin panic" {
			t.Errorf("expected error %q, got %q", "plugin panic", span.errors[0].Error())
		}
	})
}
