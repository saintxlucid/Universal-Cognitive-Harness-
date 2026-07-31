# Security Policy

## Supported Versions

This workspace is under active development. Security patches are applied to the
latest version of each project.

## Reporting a Vulnerability

Please do **not** report security vulnerabilities through public GitHub issues.

Instead, contact the maintainers directly. We will acknowledge receipt within
48 hours and provide a timeline for a fix.

## Best Practices

- Never commit secrets, tokens, or credentials to the repository
- Use `.env` files for local configuration and never commit them
- Run `npm audit` regularly to identify vulnerable dependencies
- Keep all dependencies up-to-date via Dependabot
