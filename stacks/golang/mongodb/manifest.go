package mongodb

// MongoManifest represents the top-level MongoDB query manifest structure.
type MongoManifest struct {
	Version int                            `json:"version"`
	Dialect string                         `json:"dialect"`
	Queries map[string]*MongoQueryManifest `json:"queries"`
}

// MongoQueryManifest represents a single MongoDB query entry in the manifest.
type MongoQueryManifest struct {
	Name       string                      `json:"name"`
	Hash       string                      `json:"hash"`
	Descriptor map[string]any              `json:"descriptor"`
	Params     map[string]*MongoParamDef   `json:"params"`
	Schema     map[string]any              `json:"schema"`
}

// MongoParamDef describes a parameter declared on a MongoDB query.
type MongoParamDef struct {
	Name      string `json:"name"`
	IsContext bool   `json:"isContext"`
}
