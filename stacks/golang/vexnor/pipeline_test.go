package vexnor_test

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/vexnor-dev/vexnor/stacks/golang/vexnor"
)

// lifecycleTracker records which pipeline hooks were called and in what order.
type lifecycleTracker struct {
	name    string
	calls   []string
	onError []error
}

func newLifecycleTracker(name string) *lifecycleTracker {
	return &lifecycleTracker{name: name}
}

func (l *lifecycleTracker) Name() string { return l.name }
func (l *lifecycleTracker) Init(_ *vexnor.PipelineExecutionArgs) {
	l.calls = append(l.calls, "Init")
}
func (l *lifecycleTracker) Check(_ *vexnor.PipelineExecutionArgs) error {
	l.calls = append(l.calls, "Check")
	return nil
}
func (l *lifecycleTracker) Before(_ *vexnor.PipelineExecutionArgs) {
	l.calls = append(l.calls, "Before")
}
func (l *lifecycleTracker) End(_ *vexnor.PipelineEndArgs) {
	l.calls = append(l.calls, "End")
}
func (l *lifecycleTracker) OnError(err error, _ *vexnor.PipelineExecutionArgs) {
	l.onError = append(l.onError, err)
}

// rejectingPlugin rejects at Check phase.
type rejectingPlugin struct {
	lifecycleTracker
	rejectErr error
}

func newRejectingPlugin(name string, err error) *rejectingPlugin {
	return &rejectingPlugin{
		lifecycleTracker: lifecycleTracker{name: name},
		rejectErr:        err,
	}
}

func (r *rejectingPlugin) Check(args *vexnor.PipelineExecutionArgs) error {
	r.calls = append(r.calls, "Check")
	return r.rejectErr
}

func TestPipeline_Execute_FullLifecycle(t *testing.T) {
	t.Run("runs Init, Check, Before, execute, End in order", func(t *testing.T) {
		pipeline := vexnor.NewQueryPipeline()
		tracker := newLifecycleTracker("tracker")
		pipeline.Use(tracker)

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		executed := false
		result, err := pipeline.Execute(args, func() (any, error) {
			executed = true
			return "result", nil
		})

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result != "result" {
			t.Fatalf("expected result %q, got %q", "result", result)
		}
		if !executed {
			t.Fatal("fn was not executed")
		}

		expected := []string{"Init", "Check", "Before", "End"}
		if len(tracker.calls) != len(expected) {
			t.Fatalf("expected calls %v, got %v", expected, tracker.calls)
		}
		for i, call := range expected {
			if tracker.calls[i] != call {
				t.Errorf("call[%d]: expected %q, got %q", i, call, tracker.calls[i])
			}
		}
	})
}

func TestPipeline_Execute_EndFiresOnAuthFailure(t *testing.T) {
	t.Run("Init and End pair even on auth failure", func(t *testing.T) {
		pipeline := vexnor.NewQueryPipeline()
		tracker := newLifecycleTracker("tracker")
		pipeline.Use(tracker)

		pipeline.RegisterAuthorization(func(args *vexnor.AuthorizeArgs) error {
			return errors.New("forbidden")
		})

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "protectedQuery",
			Query: &vexnor.QueryDefinition{
				Authorization: []string{"admin"},
			},
		}

		executed := false
		_, err := pipeline.Execute(args, func() (any, error) {
			executed = true
			return nil, nil
		})

		if err == nil {
			t.Fatal("expected authorization error")
		}
		if !errors.Is(err, vexnor.ErrAuthorizationDenied) {
			t.Fatalf("expected ErrAuthorizationDenied, got %v", err)
		}
		if executed {
			t.Fatal("fn should not have been executed after auth failure")
		}

		// Init and End should have fired, but not Check or Before
		if len(tracker.calls) != 2 {
			t.Fatalf("expected [Init, End], got %v", tracker.calls)
		}
		if tracker.calls[0] != "Init" {
			t.Errorf("expected first call to be Init, got %q", tracker.calls[0])
		}
		if tracker.calls[1] != "End" {
			t.Errorf("expected second call to be End, got %q", tracker.calls[1])
		}
	})
}

func TestPipeline_Execute_AuthSkippedWhenNoTags(t *testing.T) {
	t.Run("auth is skipped when query has no authorization tags", func(t *testing.T) {
		pipeline := vexnor.NewQueryPipeline()
		tracker := newLifecycleTracker("tracker")
		pipeline.Use(tracker)

		authCalled := false
		pipeline.RegisterAuthorization(func(args *vexnor.AuthorizeArgs) error {
			authCalled = true
			return errors.New("should not be called")
		})

		// No Authorization field set (empty)
		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "untaggedQuery",
			Query: &vexnor.QueryDefinition{
				Authorization: nil,
			},
		}

		result, err := pipeline.Execute(args, func() (any, error) {
			return "ok", nil
		})

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result != "ok" {
			t.Fatalf("expected result %q, got %q", "ok", result)
		}
		if authCalled {
			t.Fatal("auth hook should not have been called")
		}
		// Full lifecycle: Init, Check, Before, End
		expected := []string{"Init", "Check", "Before", "End"}
		if len(tracker.calls) != len(expected) {
			t.Fatalf("expected calls %v, got %v", expected, tracker.calls)
		}
	})
}

func TestPipeline_Execute_CheckPluginRejects(t *testing.T) {
	t.Run("Check rejection skips Before/execute but Init and End still fire", func(t *testing.T) {
		pipeline := vexnor.NewQueryPipeline()

		rejector := newRejectingPlugin("rejector", errors.New("rate limited"))
		pipeline.Use(rejector)

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		executed := false
		_, err := pipeline.Execute(args, func() (any, error) {
			executed = true
			return nil, nil
		})

		if err == nil {
			t.Fatal("expected rejection error")
		}
		if err.Error() != "rate limited" {
			t.Fatalf("expected error %q, got %q", "rate limited", err.Error())
		}
		if executed {
			t.Fatal("fn should not have been executed after check rejection")
		}

		// Init and Check fire, then End (no Before since check rejected)
		expected := []string{"Init", "Check", "End"}
		if len(rejector.calls) != len(expected) {
			t.Fatalf("expected calls %v, got %v", expected, rejector.calls)
		}
		for i, call := range expected {
			if rejector.calls[i] != call {
				t.Errorf("call[%d]: expected %q, got %q", i, call, rejector.calls[i])
			}
		}
	})
}

func TestPipeline_CheckAuthorization_ThrowsWhenNoHooks(t *testing.T) {
	t.Run("returns error when tagged queries exist but no hooks registered", func(t *testing.T) {
		pipeline := vexnor.NewQueryPipeline()

		queries := []*vexnor.QueryDefinition{
			{Name: "q1", Authorization: []string{"admin"}},
			{Name: "q2", Authorization: []string{"user"}},
		}

		err := pipeline.CheckAuthorization(queries)
		if err == nil {
			t.Fatal("expected error for unprotected queries")
		}
		if !errors.Is(err, vexnor.ErrAuthorizationDenied) {
			t.Fatalf("expected ErrAuthorizationDenied, got %v", err)
		}
	})
}

func TestPipeline_CheckAuthorization_PassesWhenHookRegistered(t *testing.T) {
	t.Run("returns nil when authorization hook is registered", func(t *testing.T) {
		pipeline := vexnor.NewQueryPipeline()
		pipeline.RegisterAuthorization(func(args *vexnor.AuthorizeArgs) error {
			return nil
		})

		queries := []*vexnor.QueryDefinition{
			{Name: "q1", Authorization: []string{"admin"}},
		}

		err := pipeline.CheckAuthorization(queries)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}

func TestPipeline_Execute_EndArgsContainsDuration(t *testing.T) {
	t.Run("EndArgs contains positive duration", func(t *testing.T) {
		pipeline := vexnor.NewQueryPipeline()

		var capturedDuration int64
		capturePlugin := &durationCapturePlugin{
			lifecycleTracker: lifecycleTracker{name: "capture"},
			onEnd: func(args *vexnor.PipelineEndArgs) {
				capturedDuration = args.DurationMs
			},
		}
		pipeline.Use(capturePlugin)

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		_, _ = pipeline.Execute(args, func() (any, error) {
			time.Sleep(5 * time.Millisecond)
			return nil, nil
		})

		if capturedDuration < 0 {
			t.Fatalf("expected non-negative duration, got %d", capturedDuration)
		}
	})
}

func TestPipeline_Execute_EndArgsContainsError(t *testing.T) {
	t.Run("EndArgs contains error on execution failure", func(t *testing.T) {
		pipeline := vexnor.NewQueryPipeline()

		var capturedError error
		capturePlugin := &durationCapturePlugin{
			lifecycleTracker: lifecycleTracker{name: "capture"},
			onEnd: func(args *vexnor.PipelineEndArgs) {
				capturedError = args.Error
			},
		}
		pipeline.Use(capturePlugin)

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		execErr := errors.New("db connection failed")
		_, err := pipeline.Execute(args, func() (any, error) {
			return nil, execErr
		})

		if err == nil {
			t.Fatal("expected error")
		}
		if capturedError == nil {
			t.Fatal("expected EndArgs to contain the error")
		}
		if capturedError.Error() != execErr.Error() {
			t.Fatalf("expected error %q, got %q", execErr.Error(), capturedError.Error())
		}
	})
}

func TestPipeline_RegisterAuthorization_ReturnsUnregisterFunction(t *testing.T) {
	t.Run("unregister removes the hook", func(t *testing.T) {
		pipeline := vexnor.NewQueryPipeline()

		callCount := 0
		unregister := pipeline.RegisterAuthorization(func(args *vexnor.AuthorizeArgs) error {
			callCount++
			return errors.New("denied")
		})

		queries := []*vexnor.QueryDefinition{
			{Name: "q1", Authorization: []string{"admin"}},
		}

		// Hook is registered — CheckAuthorization should pass
		err := pipeline.CheckAuthorization(queries)
		if err != nil {
			t.Fatalf("unexpected error with hook registered: %v", err)
		}

		// Unregister
		unregister()

		// Now CheckAuthorization should fail because no hooks
		err = pipeline.CheckAuthorization(queries)
		if err == nil {
			t.Fatal("expected error after unregister")
		}
	})

	t.Run("unregister is idempotent", func(t *testing.T) {
		pipeline := vexnor.NewQueryPipeline()

		unregister := pipeline.RegisterAuthorization(func(args *vexnor.AuthorizeArgs) error {
			return nil
		})

		// Call unregister twice — should not panic
		unregister()
		unregister()
	})
}

func TestPipeline_Execute_MultiplePluginsRunInOrder(t *testing.T) {
	t.Run("plugins execute in registration order", func(t *testing.T) {
		pipeline := vexnor.NewQueryPipeline()

		var order []string
		for i := 0; i < 3; i++ {
			i := i
			plugin := &orderTrackingPlugin{
				name: fmt.Sprintf("plugin-%d", i),
				onInit: func() {
					order = append(order, fmt.Sprintf("Init-%d", i))
				},
				onCheck: func() error {
					order = append(order, fmt.Sprintf("Check-%d", i))
					return nil
				},
				onBefore: func() {
					order = append(order, fmt.Sprintf("Before-%d", i))
				},
				onEnd: func() {
					order = append(order, fmt.Sprintf("End-%d", i))
				},
			}
			pipeline.Use(plugin)
		}

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
		}

		_, _ = pipeline.Execute(args, func() (any, error) {
			return nil, nil
		})

		expected := []string{
			"Init-0", "Init-1", "Init-2",
			"Check-0", "Check-1", "Check-2",
			"Before-0", "Before-1", "Before-2",
			"End-0", "End-1", "End-2",
		}
		if len(order) != len(expected) {
			t.Fatalf("expected %d calls, got %d: %v", len(expected), len(order), order)
		}
		for i, call := range expected {
			if order[i] != call {
				t.Errorf("call[%d]: expected %q, got %q", i, call, order[i])
			}
		}
	})
}

func TestPipeline_Execute_NilQuery(t *testing.T) {
	t.Run("nil query skips auth and executes normally", func(t *testing.T) {
		pipeline := vexnor.NewQueryPipeline()
		tracker := newLifecycleTracker("tracker")
		pipeline.Use(tracker)

		pipeline.RegisterAuthorization(func(args *vexnor.AuthorizeArgs) error {
			return errors.New("should not be called")
		})

		args := &vexnor.PipelineExecutionArgs{
			Hash: "hash1",
			Name: "testQuery",
			// Query is nil
		}

		result, err := pipeline.Execute(args, func() (any, error) {
			return 42, nil
		})

		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result != 42 {
			t.Fatalf("expected result 42, got %v", result)
		}
	})
}

// --- Helper plugin types ---

// durationCapturePlugin captures End args.
type durationCapturePlugin struct {
	lifecycleTracker
	onEnd func(*vexnor.PipelineEndArgs)
}

func (d *durationCapturePlugin) End(args *vexnor.PipelineEndArgs) {
	d.calls = append(d.calls, "End")
	if d.onEnd != nil {
		d.onEnd(args)
	}
}

// orderTrackingPlugin lets tests control each hook with callbacks.
type orderTrackingPlugin struct {
	name     string
	onInit   func()
	onCheck  func() error
	onBefore func()
	onEnd    func()
}

func (o *orderTrackingPlugin) Name() string { return o.name }
func (o *orderTrackingPlugin) Init(_ *vexnor.PipelineExecutionArgs) {
	if o.onInit != nil {
		o.onInit()
	}
}
func (o *orderTrackingPlugin) Check(_ *vexnor.PipelineExecutionArgs) error {
	if o.onCheck != nil {
		return o.onCheck()
	}
	return nil
}
func (o *orderTrackingPlugin) Before(_ *vexnor.PipelineExecutionArgs) {
	if o.onBefore != nil {
		o.onBefore()
	}
}
func (o *orderTrackingPlugin) End(_ *vexnor.PipelineEndArgs) {
	if o.onEnd != nil {
		o.onEnd()
	}
}
func (o *orderTrackingPlugin) OnError(_ error, _ *vexnor.PipelineExecutionArgs) {}
