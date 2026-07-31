export type FactKind = 'event' | 'preference' | 'commitment' | 'belief' | 'fact';
export type FactVisibility = 'private' | 'world';
export type FactNotability = 'high' | 'medium' | 'low';

export interface FactRow {
  number: number;
  claim: string;
  kind: FactKind;
  confidence: number;
  visibility: FactVisibility;
  notability: FactNotability;
  validFrom?: string;
  validUntil?: string;
  source?: string;
  context?: string;
  metric?: string;
  value?: number;
  unit?: string;
  period?: string;
  supersededBy?: number;
  forgottenReason?: string;
  active: boolean;
}

export interface FactsFence {
  marker: string;
  rows: FactRow[];
}

export const FACTS_FENCE_BEGIN = '<!--- uch:facts:begin -->';
export const FACTS_FENCE_END = '<!--- uch:facts:end -->';

export const FACT_KINDS: FactKind[] = ['event', 'preference', 'commitment', 'belief', 'fact'];
export const FACT_VISIBILITIES: FactVisibility[] = ['private', 'world'];
export const FACT_NOTABILITIES: FactNotability[] = ['high', 'medium', 'low'];

export interface FactParseResult {
  fence: FactsFence | null;
  warnings: string[];
}

const KIND_ALIASES: Record<string, FactKind> = {
  event: 'event',
  preference: 'preference',
  commitment: 'commitment',
  belief: 'belief',
  fact: 'fact',
};

export function isFactKind(value: string): value is FactKind {
  return value in KIND_ALIASES;
}

function normalizeKind(raw: string): FactKind | null {
  const value = raw.trim().toLowerCase();
  return KIND_ALIASES[value] ?? null;
}

function parseConfidence(raw: string): number | null {
  const value = Number(raw.trim());
  if (Number.isNaN(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function parseVisibility(raw: string): FactVisibility | null {
  const value = raw.trim().toLowerCase();
  if (value === 'private' || value === 'world') return value;
  return null;
}

function parseNotability(raw: string): FactNotability | null {
  const value = raw.trim().toLowerCase();
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return null;
}

function parseDate(raw: string): string | null {
  const value = raw.trim();
  if (!value || value === '-') return null;
  return value;
}

function parseNumber(raw: string): number | null {
  const value = raw.trim();
  if (!value || value === '-') return null;
  const num = Number(value.replace(/[,$%]/g, ''));
  return Number.isNaN(num) ? null : num;
}

function parseClaimCell(raw: string): { claim: string; supersededBy?: number; forgottenReason?: string } {
  const value = raw.trim();
  const strikethrough = /^~~(.+)~~$/.exec(value);
  if (!strikethrough) {
    return { claim: value };
  }
  const body = strikethrough[1]!.trim();
  const superseded = /^superseded by #(\d+)$/i.exec(body);
  if (superseded) {
    return { claim: body, supersededBy: Number(superseded[1]) };
  }
  const forgotten = /^forgotten:\s*(.+)$/i.exec(body);
  if (forgotten) {
    return { claim: body, forgottenReason: forgotten[1]!.trim() };
  }
  return { claim: body };
}

export function parseFactsFence(markdown: string): FactParseResult {
  const warnings: string[] = [];
  const beginIndex = markdown.indexOf(FACTS_FENCE_BEGIN);
  if (beginIndex < 0) {
    return { fence: null, warnings };
  }
  const endIndex = markdown.indexOf(FACTS_FENCE_END, beginIndex);
  if (endIndex < 0) {
    warnings.push('Facts fence opened but never closed');
    return { fence: null, warnings };
  }

  const body = markdown.slice(beginIndex + FACTS_FENCE_BEGIN.length, endIndex);
  const lines = body.split('\n');
  const rows: FactRow[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.split('|').map((c) => c.trim()).filter((c) => c !== '');
    const normalized = cells[0] === '#' ? cells.slice(1) : cells;
    if (normalized.length === 0) continue;

    const numberRaw = normalized[0];
    if (!numberRaw || numberRaw === '-') continue;
    const number = Number(numberRaw);
    if (Number.isNaN(number)) {
      if (/^--+$/.test(numberRaw)) continue;
      warnings.push(`Skipping malformed fact row: ${trimmed.slice(0, 60)}`);
      continue;
    }

    const kindRaw = normalized[2] ?? '';
    const kind = normalizeKind(kindRaw);
    if (!kind) {
      warnings.push(`Row #${number}: unknown kind "${kindRaw}"`);
      continue;
    }

    const confidence = parseConfidence(normalized[3] ?? '');
    if (confidence === null) {
      warnings.push(`Row #${number}: invalid confidence "${normalized[3]}"`);
      continue;
    }

    const visibility = parseVisibility(normalized[4] ?? '') ?? 'world';
    const notability = parseNotability(normalized[5] ?? '') ?? 'low';
    const claimInfo = parseClaimCell(normalized[1] ?? '');

    const row: FactRow = {
      number,
      claim: claimInfo.claim,
      kind,
      confidence,
      visibility,
      notability,
      validFrom: parseDate(normalized[6] ?? '') ?? undefined,
      validUntil: parseDate(normalized[7] ?? '') ?? undefined,
      source: parseDate(normalized[8] ?? '') ?? undefined,
      context: parseDate(normalized[9] ?? '') ?? undefined,
      supersededBy: claimInfo.supersededBy,
      forgottenReason: claimInfo.forgottenReason,
      active: !claimInfo.supersededBy && !claimInfo.forgottenReason,
    };

    if (normalized.length >= 12) {
      row.metric = normalized[10] === '-' ? undefined : normalized[10];
      row.value = parseNumber(normalized[11] ?? '') ?? undefined;
      row.unit = normalized[12] === '-' ? undefined : normalized[12];
      row.period = normalized[13] === '-' ? undefined : normalized[13];
    }

    rows.push(row);
  }

  return {
    fence: { marker: 'uch', rows },
    warnings,
  };
}

function cell(value: string | number | undefined, empty = '-'): string {
  if (value === undefined || value === null || value === '') return empty;
  return String(value);
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function renderFactsFence(rows: FactRow[]): string {
  const header = [
    '#',
    'claim',
    'kind',
    'confidence',
    'visibility',
    'notability',
    'valid_from',
    'valid_until',
    'source',
    'context',
    'metric',
    'value',
    'unit',
    'period',
  ].join(' | ');
  const divider = ['--', '--', '--', '--', '--', '--', '--', '--', '--', '--', '--', '--', '--', '--'].join(' | ');

  const lines = rows.map((row) => {
    let claim = escapeCell(row.claim);
    if (!row.active) {
      if (row.supersededBy !== undefined) {
        claim = `~~superseded by #${row.supersededBy}~~`;
      } else if (row.forgottenReason !== undefined) {
        claim = `~~forgotten: ${escapeCell(row.forgottenReason)}~~`;
      } else {
        claim = `~~${claim}~~`;
      }
    }
    return [
      row.number,
      claim,
      row.kind,
      row.confidence.toFixed(2),
      row.visibility,
      row.notability,
      cell(row.validFrom),
      cell(row.validUntil),
      cell(row.source),
      cell(row.context),
      cell(row.metric),
      cell(row.value),
      cell(row.unit),
      cell(row.period),
    ].join(' | ');
  });

  return [
    FACTS_FENCE_BEGIN,
    '',
    `| ${header} |`,
    `| ${divider} |`,
    ...lines.map((line) => `| ${line} |`),
    '',
    FACTS_FENCE_END,
  ].join('\n');
}

export function isExpired(row: FactRow, now: Date = new Date()): boolean {
  if (!row.validUntil) return false;
  const expiry = new Date(row.validUntil);
  return !Number.isNaN(expiry.getTime()) && expiry < now;
}

export function effectiveFacts(fence: FactsFence): FactRow[] {
  return fence.rows.filter((row) => row.active && !isExpired(row));
}

export interface TrajectoryPoint {
  date: string | null;
  value: number;
  unit?: string;
  period?: string;
  metric: string;
  source?: string;
}

export function findTrajectory(fence: FactsFence, metric: string): TrajectoryPoint[] {
  const normalizedMetric = metric.toLowerCase();
  return fence.rows
    .filter((row) => row.active && row.metric !== undefined && row.metric.toLowerCase() === normalizedMetric && row.value !== undefined)
    .map((row) => ({
      date: row.validFrom ?? null,
      value: row.value!,
      unit: row.unit,
      period: row.period,
      metric: row.metric!,
      source: row.source,
    }))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}

export function flagRegression(points: TrajectoryPoint[]): TrajectoryPoint[] {
  const flagged: TrajectoryPoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    if (curr.value < prev.value) {
      flagged.push({ ...curr, period: curr.period ?? 'regression' });
    }
  }
  return flagged;
}
