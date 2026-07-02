package vexnor

// PipelineExecutionArgs contains context for all pipeline lifecycle hooks.
type PipelineExecutionArgs struct {
	Hash     string
	Name     string
	Location string
	Query    *QueryDefinition
	Params   map[string]any
	Context  map[string]any
}

// PipelineEndArgs is passed to End() after execution completes.
type PipelineEndArgs struct {
	Execution  *PipelineExecutionArgs
	DurationMs int64
	Error      error // nil on success
}

// QueryPipelinePlugin is the interface for pipeline plugins.
// Lifecycle: Init → Check → Before → [execute] → End
// Init/End always fire as a pair regardless of rejections.
type QueryPipelinePlugin interface {
	Name() string
	Init(args *PipelineExecutionArgs)
	Check(args *PipelineExecutionArgs) error // return error to reject
	Before(args *PipelineExecutionArgs)
	End(args *PipelineEndArgs)
	OnError(err error, args *PipelineExecutionArgs)
}
