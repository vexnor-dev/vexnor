package vexnor

// AuditLogEntry represents a single audit log event emitted after query execution.
type AuditLogEntry struct {
	Name       string
	Hash       string
	Location   string
	DurationMs int64
	Error      string         // empty on success
	Context    map[string]any // projected context (from resolver)
}

// AuditLogOptions configures the AuditLogPlugin.
type AuditLogOptions struct {
	// Name is the plugin name.
	Name string

	// ContextLogResolver projects context values into the audit log entry.
	// If nil, no context is included in the log. Raw context is never forwarded
	// by default — only what is explicitly returned here is logged.
	ContextLogResolver func(ctx map[string]any) map[string]any

	// OnLog is called with each audit log entry after execution completes.
	// This fires on every execution — success, failure, and authorization denial.
	OnLog func(entry *AuditLogEntry)
}

// AuditLogPlugin fires an audit log entry in End() for every query execution.
type AuditLogPlugin struct {
	opts AuditLogOptions
}

// NewAuditLogPlugin creates a new AuditLogPlugin with the given options.
func NewAuditLogPlugin(opts AuditLogOptions) *AuditLogPlugin {
	if opts.Name == "" {
		opts.Name = "AuditLog"
	}
	return &AuditLogPlugin{opts: opts}
}

// Name returns the plugin name.
func (p *AuditLogPlugin) Name() string {
	return p.opts.Name
}

// Init is a no-op for the audit log plugin.
func (p *AuditLogPlugin) Init(_ *PipelineExecutionArgs) {}

// Check always returns nil — the audit log does not gate execution.
func (p *AuditLogPlugin) Check(_ *PipelineExecutionArgs) error {
	return nil
}

// Before is a no-op for the audit log plugin.
func (p *AuditLogPlugin) Before(_ *PipelineExecutionArgs) {}

// End fires the audit log entry. Called on every execution regardless of outcome.
func (p *AuditLogPlugin) End(args *PipelineEndArgs) {
	if p.opts.OnLog == nil {
		return
	}

	entry := &AuditLogEntry{
		Name:       args.Execution.Name,
		Hash:       args.Execution.Hash,
		Location:   args.Execution.Location,
		DurationMs: args.DurationMs,
	}

	if args.Error != nil {
		entry.Error = args.Error.Error()
	}

	if p.opts.ContextLogResolver != nil && args.Execution.Context != nil {
		entry.Context = p.opts.ContextLogResolver(args.Execution.Context)
	}

	p.opts.OnLog(entry)
}

// OnError is a no-op — errors are captured in End() via the Error field.
func (p *AuditLogPlugin) OnError(_ error, _ *PipelineExecutionArgs) {}
