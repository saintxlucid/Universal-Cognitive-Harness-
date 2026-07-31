# UCH Documentation Hub

Universal Cognitive Harness — a portable cognitive infrastructure layer
for AI agents. This hub indexes every reference in the project.

## Quick Start

```bash
cd projects/uch
npm install && npm run build
node dist/cli/index.js help        # CLI reference
node dist/cli/index.js status      # system health
node dist/cli/index.js             # MCP STDIO server (default)
```

## Reference

| Doc | Contents |
| --- | --- |
| [CLI.md](CLI.md) | Every `uch` command with examples |
| [MCP.md](MCP.md) | MCP transports and the 23 cognitive tools |
| [SKILLS.md](SKILLS.md) | Skill catalog/import pipeline, provenance index |
| [memory-filing-rules.md](memory-filing-rules.md) | MANDATORY rules for anything that writes to memory |
| [extraction-map.md](extraction-map.md) | Provenance record: which external patterns map to which UCH modules |
| [organism-architecture.md](organism-architecture.md) | High-level organism architecture and system topology |
| [organism-implementation.md](organism-implementation.md) | `CognitiveOrganism` implementation reference, event bus wiring, harness integration |

## Design & Governance

| Doc | Contents |
| --- | --- |
| `../design/ADR-001-workspace-owned-cognitive-runtime.md` | Architecture decision record |
| `../design/WORKSPACE-MANIFEST.md` | Workspace manifest + discovery contract (implemented) |
| `../design/PROJECTIONS.md` | Workspace-state projections — scope containment + authority intersection (implemented) |
| `../design/EVENT-GOVERNANCE.md` | Provenance-linked, policy-checked driver event gate (implemented) |
| `../design/ARCHITECTURE.md` | System architecture |
| `../design/CIC-SPECIFICATION.md` | Cognitive Information Cycle specification |
| `../design/CONFORMANCE.md` | Conformance criteria |
| `../design/FAILURE-RETRY.md` | Failure and retry model |
| `../design/PRIVACY-ERASURE.md` | Privacy and erasure guarantees |
| `../design/THREAT-MODEL.md` | Security threat model |

## Formal Specification

| Doc | Contents |
| --- | --- |
| `../SPEC.md` | Full cognitive system specification |
| `../spec/FORMAL_FOUNDATIONS.md` | Formal foundations (logic, probability, semantics) |
| `../spec/COGNITIVE_ONTOLOGY.md` | The ontology: what facts, beliefs, knowledge mean |
| `../spec/COGNITIVE_BIOLOGY.md` | Biological mapping of the architecture |
| `../spec/CONSTITUTION.md` | The Cognitive Constitution |
| `../spec/GENOME.md` | Concept genome specification |
| `../spec/LAWS_OF_COGNITIVE_PHYSICS.md` | Invariant laws of the cognitive substrate |

## Research

| Doc | Contents |
| --- | --- |
| `../research/README.md` | Research overview |
| `../research/RESEARCH_PLAN.md` | Plan and roadmap |
| `../research/RESEARCH_GOVERNANCE.md` | How research is governed |
| `../research/EVIDENCE_REGISTER.md` | Evidence provenance |
| `../research/SYNTHESIS.md` | Cross-domain synthesis |

## Project Documents

| Doc | Contents |
| --- | --- |
| `../MANIFESTO.md` | The public declaration: workspace-owned intelligence, the discipline claim, the organ contract |
| `../CHANGELOG.md` | Release history |
| `../CONTRIBUTING.md` | How to contribute |
| `../UCCP-persist-load-SUMMARY.md` | Persist/load implementation summary |
| `../.env.example` | Environment template (copy to `.env`) |
