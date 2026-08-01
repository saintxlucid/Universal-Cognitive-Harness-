/**
 * IDEA-0083 — Specification Repository (prototype, headline).
 *
 * Machine-readable specifications for every primitive family: laws,
 * signals, ISA (CP ops), memory types, drivers, runtime states,
 * lifecycles, error codes, events, capabilities, metrics, policies,
 * transactions, permissions. Each entry is validated against its
 * family schema and carries a conformance-test reference. The
 * repository is data — implementations are generated from it: the
 * `generateTsTypes` generator emits TS declaration text (e.g. the CP
 * op union) from the ISA family, proving the spec-first pipeline.
 * Deterministic: no randomness, no I/O.
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export type SpecFamily =
  | 'laws'
  | 'signals'
  | 'isa'
  | 'memory'
  | 'drivers'
  | 'runtime'
  | 'lifecycles'
  | 'errors'
  | 'events'
  | 'capabilities'
  | 'metrics'
  | 'policies'
  | 'transactions'
  | 'permissions';

export interface SpecEntry {
  readonly family: SpecFamily;
  readonly id: string;
  readonly version: string;
  /** Free-form spec body; schema-validated per family. */
  readonly body: Record<string, unknown>;
  /** Conformance-test reference (the corpus test that certifies this). */
  readonly conformance: string;
}

export interface FamilySchema {
  readonly family: SpecFamily;
  /** Required body keys for entries of this family. */
  readonly requiredKeys: readonly string[];
  readonly description: string;
}

export const FAMILY_SCHEMAS: readonly FamilySchema[] = [
  { family: 'laws', requiredKeys: ['number', 'statement'], description: 'Constitutional law: number (identity) + statement.' },
  { family: 'signals', requiredKeys: ['name', 'priority'], description: 'Signal class: name + signal priority.' },
  { family: 'isa', requiredKeys: ['op', 'category'], description: 'CP instruction: opcode + category.' },
  { family: 'memory', requiredKeys: ['kind', 'schema'], description: 'Memory type: kind + schema.' },
  { family: 'drivers', requiredKeys: ['level', 'ops'], description: 'Driver: L0-L4 level + supported ops.' },
  { family: 'runtime', requiredKeys: ['state'], description: 'Runtime state: state name.' },
  { family: 'lifecycles', requiredKeys: ['stages'], description: 'Lifecycle: ordered stages.' },
  { family: 'errors', requiredKeys: ['code', 'class'], description: 'Error code: code + failure class.' },
  { family: 'events', requiredKeys: ['type'], description: 'Event: event type.' },
  { family: 'capabilities', requiredKeys: ['id', 'version'], description: 'Capability: id + version.' },
  { family: 'metrics', requiredKeys: ['name', 'unit'], description: 'Metric: name + unit.' },
  { family: 'policies', requiredKeys: ['name'], description: 'Policy: named policy.' },
  { family: 'transactions', requiredKeys: ['op'], description: 'Transaction: op.' },
  { family: 'permissions', requiredKeys: ['scope'], description: 'Permission: scope.' },
];

/** Validates an entry against its family schema. Deterministic. */
export function validateEntry(entry: SpecEntry): string[] {
  const schema = FAMILY_SCHEMAS.find((s) => s.family === entry.family);
  if (!schema) return [`unknown family "${entry.family}"`];
  const missing = schema.requiredKeys.filter((k) => !(k in entry.body));
  if (missing.length > 0) return [`missing body key(s): ${missing.join(', ')}`];
  return [];
}

export class SpecRepository {
  private entries = new Map<string, SpecEntry>();

  register(entry: SpecEntry): string[] {
    const errors = validateEntry(entry);
    if (errors.length > 0) return errors;
    this.entries.set(`${entry.family}:${entry.id}`, entry);
    return [];
  }

  get(family: SpecFamily, id: string): SpecEntry | undefined {
    return this.entries.get(`${family}:${id}`);
  }

  list(family: SpecFamily): SpecEntry[] {
    return Array.from(this.entries.values()).filter((e) => e.family === family);
  }

  all(): SpecEntry[] {
    return Array.from(this.entries.values());
  }
}

// ── Generator ──────────────────────────────────────────────

export interface GeneratedTypes {
  readonly family: SpecFamily;
  readonly typeName: string;
  /** Emitted TypeScript declaration text (implementations are generated). */
  readonly code: string;
  readonly generatedFrom: readonly string[];
}

/**
 * Generates TS declaration text from the ISA family: the union of
 * opcodes becomes a string-literal union type. This is the proof
 * case: the CP instruction catalog (catalog.ts) is seeded into the
 * repository as data, and this generator emits the type that
 * handwritten code currently hard-codes.
 */
export function generateTsTypes(repo: SpecRepository, family: SpecFamily = 'isa'): GeneratedTypes | undefined {
  const entries = repo.list(family);
  if (entries.length === 0) return undefined;
  const typeName = family === 'isa' ? 'CPOp' : `${family.charAt(0).toUpperCase()}${family.slice(1)}Id`;
  const values = entries
    .map((e) => {
      const op = e.body['op'] ?? e.body['id'];
      return typeof op === 'string' ? op : undefined;
    })
    .filter((v): v is string => v !== undefined)
    .sort();
  if (values.length === 0) return undefined;
  const code = `// Generated from ${family} spec family (IDEA-0083). Do not edit by hand.\nexport type ${typeName} =\n  | ${values.map((v) => `'${v}'`).join('\n  | ')};\n`;
  return { family, typeName, code, generatedFrom: entries.map((e) => e.id) };
}
