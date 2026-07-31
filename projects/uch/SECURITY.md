# Security Policy for UCH

## Reporting a vulnerability

Security issues are handled with priority. Do **not** open a public issue
for a vulnerability. Report privately to the maintainers (via a private
channel or a draft advisory) with:

- Affected version(s) and commit hash if known
- A minimal reproduction
- Impact assessment (what a successful exploit enables)

You will receive an acknowledgment within one cycle, and a fix is shipped
as a patch release. Reproductions that include a working fix are welcome.

## Scope

UCH is a cognitive substrate that runs locally and holds workspace
cognition: memory, decisions, skills, grants, and traces. The security
posture is defined by:

| Document | Contents |
| --- | --- |
| [design/THREAT-MODEL.md](design/THREAT-MODEL.md) | The threat model: actors, surfaces, mitigations |
| [design/PRIVACY-ERASURE.md](design/PRIVACY-ERASURE.md) | Privacy and erasure guarantees |
| [design/CIC-SPECIFICATION.md](design/CIC-SPECIFICATION.md) | Capability grants, scope cascade, operation families |
| [design/CONFORMANCE.md](design/CONFORMANCE.md) | Conformance criteria |
| [BUG-REPORT.md](BUG-REPORT.md) | Security audit register — 8/8 findings fixed (2026-07-31) |

## Guarantees

1. **Zero trust by default** (Law 29 — Isolation). Grants are issued, never
   inherited; every driver observation passes the governance gate
   (provenance, idempotency, policy, grant, audit).
2. **No shell injection, no path traversal.** Command execution uses
   arg-array exec with denylist/metachar gates; file tools resolve within
   the workspace root.
3. **No secrets in the repository.** `.env.example` contains names only.
   Anything matching `api_key|password|secret|token` is blocked from
   shared logs.
4. **Packages cannot claim cognition** (Law 19). Signed manifests,
   tamper detection, policy quarantine.
5. **Chain-of-thought is excluded** from the ledger; decision provenance
   is preserved (ADR-002 §5).

## Reporting checklist (for auditors)

- Run `npm run audit`-equivalent (`npm audit`) after install
- Review `design/THREAT-MODEL.md` against the code in `src/control-plane/`,
  `src/agentic/`, `src/coding/`, `src/kernel/cic/`, `src/drivers/`
- Verify the conformance suite: `node dist/cli/index.js` MCP tools
  `conformance.*`, `uch engineering-benchmark`
