package vexnor

import "errors"

// Sentinel errors returned by the vexnor SDK.
var (
	// ErrUnknownQuery is returned when a query hash is not found in the registry.
	ErrUnknownQuery = errors.New("vexnor: unknown query")

	// ErrContextMissing is returned when a required context value is not provided.
	ErrContextMissing = errors.New("vexnor: required context value missing")

	// ErrValidation is returned when parameter validation fails.
	ErrValidation = errors.New("vexnor: parameter validation failed")

	// ErrRateLimited is returned when a rate limit is exceeded.
	ErrRateLimited = errors.New("vexnor: rate limit exceeded")

	// ErrManifestVersion is returned when a manifest has an unsupported version.
	ErrManifestVersion = errors.New("vexnor: unsupported manifest version")

	// ErrAuthorizationDenied is returned when an authorization hook rejects execution.
	ErrAuthorizationDenied = errors.New("vexnor: authorization denied")
)
