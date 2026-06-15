# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in vexnor, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please report them via [GitHub Security Advisories](https://github.com/vexnor-dev/vexnor/security/advisories/new).

### What to include

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fix (optional)

### What to expect

- **Acknowledgment** within 48 hours of your report
- **Status update** within 7 days with an assessment and expected timeline
- **Fix timeline** — critical vulnerabilities will be patched within 14 days; lower-severity issues within 30 days
- **Credit** — reporters will be credited in the release notes unless they prefer to remain anonymous

### Scope

The following are in scope:

- SQL injection bypasses in the query builder or template tag
- Authentication or authorization bypass in `SqlQueryRegistry` or pipeline hooks
- Remote code execution via crafted query hashes or parameters
- Dependency vulnerabilities in direct dependencies

The following are out of scope:

- Vulnerabilities in user application code built with vexnor
- Issues requiring physical access to the server
- Social engineering attacks
