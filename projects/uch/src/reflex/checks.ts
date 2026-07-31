import * as path from 'node:path';
import type { GraphNode } from '../kernel/storage/graph-store.js';
import type { CapabilityScope } from '../cognitive-runtime/capability-registry.js';
import type { WorkspaceKnowledgeGraph } from '../workspace-graphs/knowledge-graph.js';
import type { WorkspaceDecisionGraph } from '../workspace-graphs/decision-graph.js';
import type { ReflexCheck, ReflexEvidence, WriteProposal } from './types.js';

export interface ReflexGraphPicks {
  knowledgeGraph?: Pick<WorkspaceKnowledgeGraph, 'search' | 'findArtifacts'>;
  decisionGraph?: Pick<WorkspaceDecisionGraph, 'search'>;
  grant?: { workspace: string; scope: CapabilityScope } | null;
}

const TOKEN_OVERLAP_RATIO = 0.6;
const LINE_COMPLEXITY_THRESHOLD = 400;
const FUNCTION_COUNT_DEFER = 25;
const IMPORT_RE = /^\s*import\s+.*?\s+from\s+['"]([^'"]+)['"]/gm;
const REQUIRE_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
const FUNCTION_RE = /function\s+\w+\s*\(|=>\s*{/gm;

export function createReflexChecks(options: ReflexGraphPicks = {}): ReflexCheck[] {
  return [
    duplicateAbstractionCheck(options),
    duplicateDependencyCheck(options),
    complexityThresholdCheck(),
    ownershipBoundaryCheck(options),
  ];
}

function duplicateAbstractionCheck(options: ReflexGraphPicks): ReflexCheck {
  return {
    id: 'duplicate-abstraction',
    rule: 'duplicate-abstraction-overlap',
    evaluate: (proposal) => {
      const proposalTokens = tokenize(path.basename(proposal.target));
      if (proposalTokens.length === 0) return null;
      const hits = collectHits(proposalTokens, options.knowledgeGraph, options.decisionGraph);
      const overlaps = hits.filter((hit) => {
        if (hit.id === `file:${proposal.target}`) return false;
        const hitTokens = tokenize(hit.name);
        const shared = hitTokens.filter((t) => proposalTokens.includes(t)).length;
        return shared / proposalTokens.length >= TOKEN_OVERLAP_RATIO;
      });
      if (overlaps.length === 0) return null;
      return {
        check_id: 'duplicate-abstraction',
        rule: 'duplicate-abstraction-overlap',
        level: 'block',
        evidence: overlaps.map((n) => n.id),
        threshold: 'overlap>=0.6',
        reason: `${proposal.target} overlaps existing ${overlaps[0]!.type} ${overlaps[0]!.name}`,
      };
    },
  };
}

function duplicateDependencyCheck(options: ReflexGraphPicks): ReflexCheck {
  return {
    id: 'duplicate-dependency',
    rule: 'dependency-inventory-collision',
    evaluate: (proposal) => {
      const kg = options.knowledgeGraph;
      if (!kg || !proposal.content) return null;
      const specifiers = extractImportSpecifiers(proposal.content);
      if (specifiers.length === 0) return null;
      const evidence: string[] = [];
      const seen = new Set<string>();
      for (const specifier of specifiers) {
        const base = normalizeName(path.basename(specifier));
        if (!base) continue;
        for (const node of safeSearch(kg.search, base)) {
          if (node.id === `file:${proposal.target}`) continue;
          if (normalizeName(node.name) !== base) continue;
          if (!seen.has(node.id)) {
            seen.add(node.id);
            evidence.push(node.id);
          }
          evidence.push(`import:${specifier}`);
        }
      }
      if (evidence.length === 0) return null;
      return {
        check_id: 'duplicate-dependency',
        rule: 'dependency-inventory-collision',
        level: 'block',
        evidence,
        threshold: 'import-collision',
        reason: `import collides with existing dependency inventory`,
      };
    },
  };
}

function complexityThresholdCheck(): ReflexCheck {
  return {
    id: 'complexity-threshold',
    rule: 'line-complexity-threshold',
    evaluate: (proposal) => {
      if (!proposal.content) return null;
      const lines = countLines(proposal.content);
      if (lines >= LINE_COMPLEXITY_THRESHOLD) {
        return {
          check_id: 'complexity-threshold',
          rule: 'line-complexity-threshold',
          level: 'block',
          evidence: [`lines:${lines}`],
          threshold: 'lines>=400',
          reason: `${lines} lines exceeds the 400-line threshold`,
        };
      }
      const functions = (proposal.content.match(FUNCTION_RE) ?? []).length;
      if (functions >= FUNCTION_COUNT_DEFER) {
        return {
          check_id: 'complexity-threshold',
          rule: 'function-count-defer',
          level: 'defer',
          evidence: [`functions:${functions}`],
          threshold: 'functions>=25',
          reason: `${functions} functions exceed the 25-function threshold`,
        };
      }
      return null;
    },
  };
}

function ownershipBoundaryCheck(options: ReflexGraphPicks): ReflexCheck {
  return {
    id: 'ownership-boundary',
    rule: 'ownership-scope-violation',
    evaluate: (proposal) => {
      const grant = options.grant;
      if (!grant || !grant.workspace) return null;
      const scope = grant.scope;
      const workspaceRoot = path.resolve(grant.workspace);
      const targetResolved = path.resolve(grant.workspace, proposal.target);
      if (scope.project) {
        const projectPin = path.resolve(workspaceRoot, 'projects', scope.project);
        if (!targetResolved.startsWith(projectPin)) {
          return blockEvidence(
            proposal,
            [`scope:project:${scope.project}`, `target:${proposal.target}`],
            `${proposal.target} is outside the ${scope.project} project pin`,
          );
        }
      } else if (scope.branch) {
        if (!targetResolved.startsWith(workspaceRoot)) {
          return blockEvidence(
            proposal,
            [`scope:branch:${scope.branch}`, `target:${proposal.target}`],
            `${proposal.target} escapes the workspace root`,
          );
        }
      }
      return null;
    },
  };
}

function blockEvidence(proposal: WriteProposal, evidence: string[], reason: string): ReflexEvidence {
  return {
    check_id: 'ownership-boundary',
    rule: 'ownership-scope-violation',
    level: 'block',
    evidence,
    reason,
  };
}

function tokenize(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .flatMap((token) => token.replace(/([a-zA-Z])(\d+)/g, '$1 $2').split(' '))
    .map((token) => token.toLowerCase());
}

function collectHits(
  tokens: string[],
  knowledgeGraph?: Pick<WorkspaceKnowledgeGraph, 'search' | 'findArtifacts'>,
  decisionGraph?: Pick<WorkspaceDecisionGraph, 'search'>,
): GraphNode[] {
  const byId = new Map<string, GraphNode>();
  for (const token of tokens) {
    for (const node of safeSearch(knowledgeGraph?.search, token)) {
      if (!byId.has(node.id)) byId.set(node.id, node);
    }
    for (const node of safeSearch(decisionGraph?.search, token)) {
      if (!byId.has(node.id)) byId.set(node.id, node);
    }
  }
  return [...byId.values()];
}

function safeSearch(
  search: ((query: string) => GraphNode[]) | undefined,
  query: string,
): GraphNode[] {
  if (!search) return [];
  try {
    return search(query);
  } catch {
    return [];
  }
}

function extractImportSpecifiers(content: string): string[] {
  const specifiers = new Set<string>();
  for (const match of content.matchAll(IMPORT_RE)) {
    specifiers.add(match[1]!);
  }
  for (const match of content.matchAll(REQUIRE_RE)) {
    specifiers.add(match[1]!);
  }
  return [...specifiers];
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\.[^.]+$/, '');
}

function countLines(content: string): number {
  const lines = content.split('\n');
  return lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
}
