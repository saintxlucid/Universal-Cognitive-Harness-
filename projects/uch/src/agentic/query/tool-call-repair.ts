import type { ToolCall } from '../types.js';
import { createHash } from 'node:crypto';
import type { Tool, ToolInputSchema } from '../tools/types.js';

export interface ArgRepair {
  field: string;
  before: unknown;
  after: unknown;
  reason: string;
}

export interface RepairResult {
  input: Record<string, unknown>;
  repairs: ArgRepair[];
  jsonParseError: string | null;
}

export function parseJsonArgs(args: string | Record<string, unknown>): { input: Record<string, unknown>; error: string | null } {
  if (typeof args !== 'string') {
    return { input: args ?? {}, error: null };
  }
  const trimmed = args.trim();
  if (trimmed.length === 0) return { input: {}, error: null };
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { input: {}, error: 'Tool arguments must be a JSON object' };
    }
    return { input: parsed as Record<string, unknown>, error: null };
  } catch (error) {
    return { input: {}, error: error instanceof Error ? error.message : String(error) };
  }
}

export function coerceValue(value: unknown, schema: ToolInputSchema['properties'][string]): { value: unknown; coerced: boolean } {
  if (value === null || value === undefined) return { value, coerced: false };
  switch (schema.type) {
    case 'number': {
      if (typeof value === 'number') return { value, coerced: false };
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) return { value: parsed, coerced: true };
      }
      if (typeof value === 'boolean') return { value: value ? 1 : 0, coerced: true };
      return { value, coerced: false };
    }
    case 'boolean': {
      if (typeof value === 'boolean') return { value, coerced: false };
      if (typeof value === 'string') {
        if (value === 'true' || value === '1') return { value: true, coerced: true };
        if (value === 'false' || value === '0') return { value: false, coerced: true };
      }
      if (typeof value === 'number') return { value: value !== 0, coerced: true };
      return { value, coerced: false };
    }
    case 'string': {
      if (typeof value === 'string') return { value, coerced: false };
      if (typeof value === 'number' || typeof value === 'boolean') {
        return { value: String(value), coerced: true };
      }
      return { value, coerced: false };
    }
    case 'array': {
      if (Array.isArray(value)) return { value, coerced: false };
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return { value: parsed, coerced: true };
        } catch {
          return { value: value.split(',').map((s) => s.trim()).filter(Boolean), coerced: true };
        }
      }
      return { value, coerced: false };
    }
    case 'object': {
      if (typeof value === 'object' && !Array.isArray(value)) return { value, coerced: false };
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return { value: parsed, coerced: true };
          }
        } catch {
          // fall through
        }
      }
      return { value, coerced: false };
    }
    default:
      return { value, coerced: false };
  }
}

export function resolveEnumValue(value: unknown, allowed: string[]): { value: unknown; coerced: boolean } {
  if (typeof value !== 'string') return { value, coerced: false };
  if (allowed.includes(value)) return { value, coerced: false };
  const lower = value.toLowerCase();
  const match = allowed.find((option) => option.toLowerCase() === lower);
  if (match) return { value: match, coerced: true };
  return { value, coerced: false };
}

export function repairToolCallArguments(
  args: string | Record<string, unknown>,
  schema: ToolInputSchema,
  toolName: string,
): RepairResult {
  const { input: parsed, error: jsonParseError } = parseJsonArgs(args);
  const input = parsed;
  const repairs: ArgRepair[] = [];

  for (const [key, prop] of Object.entries(schema.properties)) {
    const value = input[key];
    if (value === undefined || value === null) {
      if (prop.default !== undefined && input[key] === undefined) {
        input[key] = prop.default;
        repairs.push({ field: key, before: undefined, after: prop.default, reason: `filled missing default for ${toolName}.${key}` });
      }
      continue;
    }
    const { value: coerced, coerced: didCoerce } = coerceValue(value, prop);
    if (didCoerce) {
      input[key] = coerced;
      repairs.push({ field: key, before: value, after: coerced, reason: `coerced ${typeof value} to ${prop.type} for ${toolName}.${key}` });
    }
    if (prop.enum && input[key] !== undefined && input[key] !== null) {
      const { value: enumValue, coerced: enumCoerced } = resolveEnumValue(input[key], prop.enum);
      if (enumCoerced) {
        input[key] = enumValue;
        repairs.push({ field: key, before: value, after: enumValue, reason: `matched enum case-insensitively for ${toolName}.${key}` });
      }
    }
  }

  return { input, repairs, jsonParseError };
}

export function deterministicToolCallId(name: string, index: number): string {
  const hash = createHash('sha256').update(`${name}:${index}`).digest('hex').slice(0, 32);
  return `toolu_${hash}`;
}

export interface DedupResult {
  calls: ToolCall[];
  removed: { call: ToolCall; duplicateOf: ToolCall }[];
}

export function deduplicateToolCalls(calls: ToolCall[]): DedupResult {
  const seen = new Map<string, ToolCall>();
  const kept: ToolCall[] = [];
  const removed: DedupResult['removed'] = [];
  for (const call of calls) {
    const key = `${call.name}:${stableStringify(call.input)}`;
    const existing = seen.get(key);
    if (existing) {
      removed.push({ call, duplicateOf: existing });
      continue;
    }
    seen.set(key, call);
    kept.push(call);
  }
  return { calls: kept, removed };
}

export interface PathOverlap {
  toolA: string;
  toolB: string;
  paths: string[];
}

const PATH_KEYS = ['path', 'filePath', 'directory', 'oldPath', 'newPath'];

function extractPaths(input: Record<string, unknown>): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (PATH_KEYS.includes(key) && typeof value === 'string') {
      paths.push(value.replace(/\\/g, '/'));
    }
  }
  return paths;
}

export function detectPathOverlap(calls: ToolCall[], tools: Tool[]): PathOverlap[] {
  const overlaps: PathOverlap[] = [];
  for (let i = 0; i < calls.length; i++) {
    const a = calls[i] as ToolCall;
    const toolA = tools.find((t) => t.name === a.name || t.aliases?.includes(a.name));
    if (toolA?.isConcurrencySafe?.(a.input as never)) continue;
    const pathsA = extractPaths(a.input);
    for (let j = i + 1; j < calls.length; j++) {
      const b = calls[j] as ToolCall;
      const toolB = tools.find((t) => t.name === b.name || t.aliases?.includes(b.name));
      if (toolB?.isConcurrencySafe?.(b.input as never)) continue;
      const shared = pathsA.filter((p) => extractPaths(b.input).includes(p));
      if (shared.length > 0) {
        overlaps.push({ toolA: a.name, toolB: b.name, paths: shared });
      }
    }
  }
  return overlaps;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([ka], [kb]) => (ka < kb ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
