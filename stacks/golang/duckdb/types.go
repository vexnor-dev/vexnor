package duckdb

// Column describes a DuckDB column using the portable Vexnor schema shape.
type Column struct {
	TableSchema           string  `json:"table_schema"`
	TableName             string  `json:"table_name"`
	ColumnName            string  `json:"column_name"`
	DataType              string  `json:"data_type"`
	IsNullable            string  `json:"is_nullable"`
	IsUpdatable           string  `json:"is_updatable"`
	ColumnDefault         *string `json:"column_default"`
	OrdinalPosition       int64   `json:"ordinal_position"`
	NumericPrecisionRadix *int64  `json:"numeric_precision_radix"`
}

// PrimaryKey describes a primary-key column.
type PrimaryKey struct {
	ConstraintName  string `json:"constraint_name"`
	TableSchema     string `json:"table_schema"`
	TableName       string `json:"table_name"`
	ColumnName      string `json:"column_name"`
	OrdinalPosition int64  `json:"ordinal_position"`
}

// ForeignKey describes a foreign-key relationship.
type ForeignKey struct {
	ConstraintName        string `json:"constraint_name"`
	TableSchema           string `json:"table_schema"`
	TableName             string `json:"table_name"`
	ColumnName            string `json:"column_name"`
	ReferencedTableSchema string `json:"referenced_table_schema"`
	ReferencedTableName   string `json:"referenced_table_name"`
	ReferencedColumnName  string `json:"referenced_column_name"`
}

// Table describes a DuckDB table or view.
type Table struct {
	TableSchema string       `json:"table_schema"`
	TableName   string       `json:"table_name"`
	TableType   string       `json:"table_type"`
	Columns     []Column     `json:"columns"`
	PrimaryKeys []PrimaryKey `json:"primary_keys"`
	ForeignKeys []ForeignKey `json:"foreign_keys,omitempty"`
}

// EnumValue describes one DuckDB enum label.
type EnumValue struct {
	EnumLabel string `json:"enum_label"`
}

// Enum describes a DuckDB enum type.
type Enum struct {
	EnumSchema string      `json:"enum_schema"`
	EnumName   string      `json:"enum_name"`
	EnumValues []EnumValue `json:"enum_values"`
}

// Schema is DuckDB schema metadata normalized for Vexnor.
type Schema struct {
	Tables []Table `json:"tables"`
	Enums  []Enum  `json:"enums"`
}
