import type { Tool, PermissionDecision, ToolUseContext } from '../tools/types.js';

export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'plan'
  | 'bypassPermissions'
  | 'dontAsk'
  | 'auto';

export interface PermissionRule {
  bucket: 'allow' | 'deny' | 'ask';
  pattern: string;
  source?: string;
}

export interface PermissionRuleSet {
  alwaysAllow: PermissionRule[];
  alwaysDeny: PermissionRule[];
  alwaysAsk: PermissionRule[];
}

export function createPermissionRuleSet(rules: PermissionRule[] = []): PermissionRuleSet {
  const set: PermissionRuleSet = { alwaysAllow: [], alwaysDeny: [], alwaysAsk: [] };
  for (const rule of rules) {
    if (rule.bucket === 'allow') set.alwaysAllow.push(rule);
    else if (rule.bucket === 'deny') set.alwaysDeny.push(rule);
    else set.alwaysAsk.push(rule);
  }
  return set;
}

export function addPermissionRule(
  set: PermissionRuleSet,
  rule: PermissionRule,
): PermissionRuleSet {
  if (rule.bucket === 'allow') {
    return { ...set, alwaysAllow: [...set.alwaysAllow, rule] };
  }
  if (rule.bucket === 'deny') {
    return { ...set, alwaysDeny: [...set.alwaysDeny, rule] };
  }
  return { ...set, alwaysAsk: [...set.alwaysAsk, rule] };
}

export function normalizePermissionPattern(toolName: string, pattern: string): string {
  const trimmed = pattern.trim();
  if (trimmed.includes('(')) return trimmed;
  return `${toolName}(${trimmed})`;
}

export function ruleMatches(rule: PermissionRule, toolName: string, input: Record<string, unknown>): boolean {
  const pattern = rule.pattern.trim();
  if (pattern === toolName) return true;
  if (!pattern.startsWith(toolName)) return false;
  const rest = pattern.slice(toolName.length);
  if (!(rest.startsWith('(') && rest.endsWith(')'))) return false;
  const inner = rest.slice(1, -1);
  if (inner === '*') return true;

  const fieldSeparator = inner.indexOf(':');
  if (fieldSeparator > 0) {
    const field = inner.slice(0, fieldSeparator);
    const fieldValue = String(input[field] ?? '');
    if (fieldValue !== '') {
      return wildcardMatch(fieldValue, inner.slice(fieldSeparator + 1));
    }
    return wildcardMatchAnyInputValue(input, inner.endsWith(':*') ? `${inner.slice(0, -2)}*` : inner);
  }
  return wildcardMatchAnyInputValue(input, inner);
}

function wildcardMatch(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

function wildcardMatchAnyInputValue(input: Record<string, unknown>, pattern: string): boolean {
  return Object.values(input).some((value) => wildcardMatch(String(value), pattern));
}

export const BYPASS_IMMUNE_SAFETY_PATTERNS = [
  /(^|\/)(\.git)(\/|$)/,
  /(^|\/)(\.claude)(\/|$)/,
  /(^|\/)(\.env)(\/|$)/,
  /(^|\/)(\.ssh)(\/|$)/,
  /(^|\/)(\.codex)(\/|$)/,
];

export function isSafetySensitiveInput(input: Record<string, unknown>): boolean {
  const haystack = Object.values(input).join(' ').toLowerCase();
  return BYPASS_IMMUNE_SAFETY_PATTERNS.some((pattern) => pattern.test(haystack));
}

export interface PermissionCheckContext {
  mode: PermissionMode;
  rules: PermissionRuleSet;
  headless?: boolean;
}

export async function hasPermissionsToUseTool(
  tool: Tool,
  input: Record<string, unknown>,
  context: ToolUseContext,
  permission: PermissionCheckContext,
): Promise<PermissionDecision> {
  if (permission.mode === 'bypassPermissions') {
    const safe = isSafetySensitiveInput(input);
    if (safe && !tool.isReadOnly?.(input as never)) {
      return { behavior: 'deny', reason: 'Safety-sensitive path is bypass-immune' };
    }
    return { behavior: 'allow', reason: 'Bypass permissions mode' };
  }

  for (const rule of permission.rules.alwaysDeny) {
    if (ruleMatches(rule, tool.name, input)) {
      return { behavior: 'deny', reason: `Deny rule: ${rule.pattern}` };
    }
  }

  if (tool.checkPermissions) {
    const toolDecision = await tool.checkPermissions(input as never, context);
    if (toolDecision.behavior === 'deny') return toolDecision;
  }

  for (const rule of permission.rules.alwaysAllow) {
    if (ruleMatches(rule, tool.name, input)) {
      if (isSafetySensitiveInput(input) && !tool.isReadOnly?.(input as never)) {
        return { behavior: 'deny', reason: 'Safety-sensitive path blocked despite allow rule' };
      }
      return { behavior: 'allow', reason: `Allow rule: ${rule.pattern}` };
    }
  }

  const isReadOnly = tool.isReadOnly?.(input as never) ?? false;
  if (permission.mode === 'acceptEdits' && (tool.name === 'Edit' || tool.name === 'Write' || tool.name === 'EditFile')) {
    return { behavior: 'allow', reason: 'Accept edits mode' };
  }
  if (permission.mode === 'plan' && (tool.name === 'Edit' || tool.name === 'Write')) {
    return { behavior: 'deny', reason: 'Plan mode: no edits allowed' };
  }

  if (isReadOnly) {
    return { behavior: 'allow', reason: 'Read-only tool' };
  }

  for (const rule of permission.rules.alwaysAsk) {
    if (ruleMatches(rule, tool.name, input)) {
      if (permission.mode === 'dontAsk' || permission.headless) {
        return { behavior: 'deny', reason: `Ask rule denied headless: ${rule.pattern}` };
      }
      return { behavior: 'ask', reason: `Ask rule: ${rule.pattern}` };
    }
  }

  switch (permission.mode) {
    case 'dontAsk':
      return { behavior: 'deny', reason: 'DontAsk mode denies non-readonly tools' };
    case 'auto':
      return permission.headless
        ? { behavior: 'deny', reason: 'Auto mode headless denies non-readonly tools' }
        : { behavior: 'ask', reason: 'Auto mode: user decision required' };
    case 'default':
      return permission.headless
        ? { behavior: 'deny', reason: 'Headless default denies non-readonly tools' }
        : { behavior: 'ask', reason: 'Permission required' };
    default:
      return { behavior: 'ask', reason: 'Permission required' };
  }
}

export const EMPTY_PERMISSION_RULE_SET: PermissionRuleSet = {
  alwaysAllow: [],
  alwaysDeny: [],
  alwaysAsk: [],
};
