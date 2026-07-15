package vexnor

import (
	"fmt"
	"sync"
)

// Tracer is a minimal interface matching the OpenTelemetry trace.Tracer contract.
// Users can pass their real OTel tracer wrapped in an adapter, or a no-op.
type Tracer interface {
	// Start begins a new span with the given name and attributes.
	Start(name string, attrs map[string]string) Span
}

// Span is a minimal interface matching the OpenTelemetry trace.Span contract.
type Span interface {
	// SetAttribute adds a key-value attribute to the span.
	SetAttribute(key, value string)
	// SetError records an error on the span.
	SetError(err error)
	// End finishes the span.
	End()
}

// NoopTracer is a Tracer that does nothing. Useful for testing or when
// OpenTelemetry is not configured.
type NoopTracer struct{}

// Start returns a no-op span.
func (NoopTracer) Start(_ string, _ map[string]string) Span {
	return &noopSpan{}
}

type noopSpan struct{}

func (*noopSpan) SetAttribute(_, _ string) {}
func (*noopSpan) SetError(_ error)          {}
func (*noopSpan) End()                      {}

// OpenTelemetryPlugin creates a span for every query execution, recording
// query metadata, duration, and errors.
type OpenTelemetryPlugin struct {
	tracer Tracer
	name   string
	spans  sync.Map // keyed by *PipelineExecutionArgs pointer
}

// NewOpenTelemetryPlugin creates a new OpenTelemetryPlugin with the given tracer.
// An optional name parameter overrides the default plugin name.
func NewOpenTelemetryPlugin(tracer Tracer, name ...string) *OpenTelemetryPlugin {
	pluginName := "OpenTelemetry"
	if len(name) > 0 && name[0] != "" {
		pluginName = name[0]
	}
	return &OpenTelemetryPlugin{
		tracer: tracer,
		name:   pluginName,
	}
}

// Name returns the plugin name.
func (p *OpenTelemetryPlugin) Name() string {
	return p.name
}

// Init starts a new span for this execution.
func (p *OpenTelemetryPlugin) Init(args *PipelineExecutionArgs) {
	spanName := "vexnor.query"
	if args.Name != "" {
		spanName = args.Name
	}

	attrs := map[string]string{
		"db.vexnor.hash":     args.Hash,
		"db.vexnor.name":     args.Name,
		"db.vexnor.location": args.Location,
	}

	span := p.tracer.Start(spanName, attrs)
	p.spans.Store(args, span)
}

// Check always returns nil — the OTel plugin does not gate execution.
func (p *OpenTelemetryPlugin) Check(_ *PipelineExecutionArgs) error {
	return nil
}

// Before adds additional attributes to the span if available.
func (p *OpenTelemetryPlugin) Before(args *PipelineExecutionArgs) {
	spanVal, ok := p.spans.Load(args)
	if !ok {
		return
	}
	span := spanVal.(Span)

	if args.Query != nil && len(args.Query.Authorization) > 0 {
		span.SetAttribute("db.vexnor.authorization", fmt.Sprintf("%v", args.Query.Authorization))
	}
}

// End finishes the span, recording duration and any error.
func (p *OpenTelemetryPlugin) End(args *PipelineEndArgs) {
	spanVal, ok := p.spans.LoadAndDelete(args.Execution)
	if !ok {
		return
	}
	span := spanVal.(Span)

	span.SetAttribute("db.vexnor.duration_ms", fmt.Sprintf("%d", args.DurationMs))

	if args.Error != nil {
		span.SetError(args.Error)
	}

	span.End()
}

// OnError records the error on the span if one is active.
func (p *OpenTelemetryPlugin) OnError(err error, args *PipelineExecutionArgs) {
	spanVal, ok := p.spans.Load(args)
	if !ok {
		return
	}
	span := spanVal.(Span)
	span.SetError(err)
}
