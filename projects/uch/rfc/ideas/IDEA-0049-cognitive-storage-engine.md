# IDEA-0049 — Cognitive Storage Engine

- **Status:** Idea (SOP-08 stage 1; no code)
- **Origin:** Vision intake 2026-08-01 (Foundation 3) — "not SQLite, not
  PostgreSQL — an abstraction over cognition. Internally it may use
  SQLite, DuckDB, Postgres, Neo4j, object storage, vector DB,
  filesystem, git, memory, or cloud — but the organism never knows"
- **Related:** src/neural-fs (version-store, mounts), Storable
  persistence, GraphStore, src/kernel/memory/vmem, .uccp/persist,
  knowledge-base + experience DBs, ADR-006 (persistence primitive),
  IDEA-0029 (cache hierarchy), design/RETRIEVAL-SCALING.md (HNSW/OPQ
  ladder)

## Motivation

Memory today is a heterogeneous collection of stores — JSON knowledge
DBs, Storable files, GraphStore graphs, neural-fs versioned files, vmem
paging — each with its own contract. The claim: one storage abstraction
with pluggable backends, so an organ reads/writes "the organism's
memory" without knowing whether the backend is a file, a graph DB, or
object storage — and so backends can be swapped, tiered, or distributed
under the contract without touching organs.

## The corpus cannot cover it because

Each store is directly addressed by its consumers; there is no unified
storage contract (put/get/query/version/scan), no backend registry, and
no placement policy (what lives hot vs cold vs archive — the vmem and
cache-hierarchy ideas cover *memory*, not *storage*).

## Proposal sketch

- Storage Engine contract: typed put/get/query, versioning, provenance
  attachment, scans; backend drivers (file, sqlite, postgres, neo4j,
  vector, object, git) behind the contract.
- Placement policy: hot/warm/cold/archive mapping (IDEA-0029 ladder)
  with policy-driven promotion.
- ADR-006's persistence primitive becomes the kernel facet of the
  engine.

## Risk assessment

- Over-abstraction: the contract must add versioning, provenance, and
  policy beyond raw backends, or it is a wrapper with no reason to
  exist.

## Where it lands

- Design doc `design/STORAGE-ENGINE.md`; extends neural-fs + Storable.

## Code impact

- None until the minimal contract is defined over existing stores.

## Next stage

Inventory existing stores and their consumers; define the minimal
contract; prototype one backend swap (file ↔ sqlite) behind it.
