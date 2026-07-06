package vexnor_test

import (
	"errors"
	"testing"

	"github.com/vexnor-dev/vexnor-go/vexnor"
)

// --- AuditLogPlugin interface methods ---

func TestAuditLogPlugin_Name(t *testing.T) {
	t.Run("default name is AuditLog", func(t *testing.T) {
		plugin := vexnor.NewAuditLogPlugin(vexnor.AuditLogOptions{})
		if plugin.Name() != "AuditLog" {
			t.Errorf("expected %q, got %q", "AuditLog", plugin.Name())
		}
	})

	t.Run("custom name is used", func(t *testing.T) {
		plugin := vexnor.NewAuditLogPlugin(vexnor.AuditLogOptions{Name: "MyAudit"})
		if plugin.Name() != "MyAudit" {
			t.Errorf("expected %q, got %q", "MyAudit", plugin.Name())
		}
	})
}

func TestAuditLogPlugin_Init(t *testing.T) {
	t.Run("Init does not panic", func(t *testing.T) {
		plugin := vexnor.NewAuditLogPlugin(vexnor.AuditLogOptions{})
		args := &vexnor.PipelineExecutionArgs{Hash: "h1", Name: "q1"}
		plugin.Init(args) // should not panic
	})
}

func TestAuditLogPlugin_Check(t *testing.T) {
	t.Run("Check always returns nil", func(t *testing.T) {
		plugin := vexnor.NewAuditLogPlugin(vexnor.AuditLogOptions{})
		args := &vexnor.PipelineExecutionArgs{Hash: "h1", Name: "q1"}
		err := plugin.Check(args)
		if err != nil {
			t.Fatalf("expected nil, got %v", err)
		}
	})
}

func TestAuditLogPlugin_Before(t *testing.T) {
	t.Run("Before does not panic", func(t *testing.T) {
		plugin := vexnor.NewAuditLogPlugin(vexnor.AuditLogOptions{})
		args := &vexnor.PipelineExecutionArgs{Hash: "h1", Name: "q1"}
		plugin.Before(args) // should not panic
	})
}

func TestAuditLogPlugin_OnError(t *testing.T) {
	t.Run("OnError does not panic", func(t *testing.T) {
		plugin := vexnor.NewAuditLogPlugin(vexnor.AuditLogOptions{})
		args := &vexnor.PipelineExecutionArgs{Hash: "h1", Name: "q1"}
		plugin.OnError(errors.New("test error"), args) // should not panic
	})
}

func TestAuditLogPlugin_EndWithNilContext(t *testing.T) {
	t.Run("End with nil context and resolver does not include context", func(t *testing.T) {
		var captured *vexnor.AuditLogEntry
		plugin := vexnor.NewAuditLogPlugin(vexnor.AuditLogOptions{
			ContextLogResolver: func(ctx map[string]any) map[string]any {
				return map[string]any{"resolved": true}
			},
			OnLog: func(entry *vexnor.AuditLogEntry) {
				captured = entry
			},
		})

		args := &vexnor.PipelineExecutionArgs{
			Hash:    "h1",
			Name:    "q1",
			Context: nil, // nil context
		}

		plugin.End(&vexnor.PipelineEndArgs{
			Execution:  args,
			DurationMs: 5,
		})

		if captured == nil {
			t.Fatal("expected log entry")
		}
		if captured.Context != nil {
			t.Errorf("expected nil context when exec context is nil, got %v", captured.Context)
		}
	})
}

// --- RateLimiterPlugin interface methods ---

func TestRateLimiterPlugin_Name(t *testing.T) {
	t.Run("default name is RateLimiter", func(t *testing.T) {
		plugin := vexnor.NewRateLimiterPlugin(vexnor.RateLimiterOptions{})
		if plugin.Name() != "RateLimiter" {
			t.Errorf("expected %q, got %q", "RateLimiter", plugin.Name())
		}
	})

	t.Run("custom name is used", func(t *testing.T) {
		plugin := vexnor.NewRateLimiterPlugin(vexnor.RateLimiterOptions{Name: "MyLimiter"})
		if plugin.Name() != "MyLimiter" {
			t.Errorf("expected %q, got %q", "MyLimiter", plugin.Name())
		}
	})
}

func TestRateLimiterPlugin_Before(t *testing.T) {
	t.Run("Before does not panic", func(t *testing.T) {
		plugin := vexnor.NewRateLimiterPlugin(vexnor.RateLimiterOptions{})
		args := &vexnor.PipelineExecutionArgs{Hash: "h1", Name: "q1"}
		plugin.Before(args) // should not panic
	})
}

func TestRateLimiterPlugin_OnError(t *testing.T) {
	t.Run("OnError does not panic", func(t *testing.T) {
		plugin := vexnor.NewRateLimiterPlugin(vexnor.RateLimiterOptions{})
		args := &vexnor.PipelineExecutionArgs{Hash: "h1", Name: "q1"}
		plugin.OnError(errors.New("test error"), args) // should not panic
	})
}

func TestRateLimiterPlugin_NilContext(t *testing.T) {
	t.Run("Init with nil context and ContextKeyResolver does not panic", func(t *testing.T) {
		plugin := vexnor.NewRateLimiterPlugin(vexnor.RateLimiterOptions{
			MaxConcurrent: 10,
			ContextKeyResolver: func(ctx map[string]any) string {
				return "key"
			},
			MaxConcurrentPerContext: 5,
		})

		args := &vexnor.PipelineExecutionArgs{
			Hash:    "h1",
			Name:    "q1",
			Context: nil,
		}

		plugin.Init(args)
		err := plugin.Check(args)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		plugin.End(&vexnor.PipelineEndArgs{Execution: args})
	})
}

func TestRateLimiterPlugin_EmptyContextKey(t *testing.T) {
	t.Run("empty context key from resolver skips per-context tracking", func(t *testing.T) {
		plugin := vexnor.NewRateLimiterPlugin(vexnor.RateLimiterOptions{
			MaxConcurrent: 10,
			ContextKeyResolver: func(ctx map[string]any) string {
				return "" // empty key
			},
			MaxConcurrentPerContext: 1,
		})

		args := &vexnor.PipelineExecutionArgs{
			Hash:    "h1",
			Name:    "q1",
			Context: map[string]any{"userId": "u1"},
		}

		// Even with MaxConcurrentPerContext=1, empty key means no per-context limit
		plugin.Init(args)
		plugin.Init(args)
		plugin.Init(args)

		err := plugin.Check(args)
		if err != nil {
			t.Fatalf("expected no error with empty context key, got %v", err)
		}
	})
}

// --- OpenTelemetryPlugin additional coverage ---

func TestOpenTelemetryPlugin_Name(t *testing.T) {
	t.Run("default name is OpenTelemetry", func(t *testing.T) {
		tracer := vexnor.NoopTracer{}
		plugin := vexnor.NewOpenTelemetryPlugin(tracer)
		if plugin.Name() != "OpenTelemetry" {
			t.Errorf("expected %q, got %q", "OpenTelemetry", plugin.Name())
		}
	})

	t.Run("custom name is used", func(t *testing.T) {
		tracer := vexnor.NoopTracer{}
		plugin := vexnor.NewOpenTelemetryPlugin(tracer, "MyOtel")
		if plugin.Name() != "MyOtel" {
			t.Errorf("expected %q, got %q", "MyOtel", plugin.Name())
		}
	})
}

func TestOpenTelemetryPlugin_BeforeWithAuthorization(t *testing.T) {
	t.Run("Before sets authorization attribute", func(t *testing.T) {
		tracer := newMockTracer()
		plugin := vexnor.NewOpenTelemetryPlugin(tracer)

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
			Query: &vexnor.QueryDefinition{
				Authorization: []string{"admin", "superuser"},
			},
		}

		plugin.Init(args)
		plugin.Before(args)

		span := tracer.spans[0]
		if _, ok := span.attrs["db.vexnor.authorization"]; !ok {
			t.Error("expected authorization attribute on span")
		}
	})
}

func TestOpenTelemetryPlugin_EndWithoutInit(t *testing.T) {
	t.Run("End without Init does not panic", func(t *testing.T) {
		tracer := newMockTracer()
		plugin := vexnor.NewOpenTelemetryPlugin(tracer)

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		// End without Init — span not found, should not panic
		plugin.End(&vexnor.PipelineEndArgs{
			Execution:  args,
			DurationMs: 10,
		})
	})
}

func TestOpenTelemetryPlugin_OnErrorWithoutInit(t *testing.T) {
	t.Run("OnError without Init does not panic", func(t *testing.T) {
		tracer := newMockTracer()
		plugin := vexnor.NewOpenTelemetryPlugin(tracer)

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		// OnError without Init — should not panic
		plugin.OnError(errors.New("test"), args)
	})
}

func TestOpenTelemetryPlugin_BeforeWithoutInit(t *testing.T) {
	t.Run("Before without Init does not panic", func(t *testing.T) {
		tracer := newMockTracer()
		plugin := vexnor.NewOpenTelemetryPlugin(tracer)

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
			Query: &vexnor.QueryDefinition{
				Authorization: []string{"admin"},
			},
		}

		// Before without Init — span not found, should not panic
		plugin.Before(args)
	})
}

func TestNoopSpan_Methods(t *testing.T) {
	t.Run("NoopTracer and noopSpan methods do not panic", func(t *testing.T) {
		tracer := vexnor.NoopTracer{}
		span := tracer.Start("test", map[string]string{"key": "val"})
		span.SetAttribute("a", "b")
		span.SetError(errors.New("err"))
		span.End()
	})
}
