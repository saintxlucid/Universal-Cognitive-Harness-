// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — persistence hydration
// JSON round-trips turn Dates into strings; every restore path revives them
// so the bi-temporal model keeps working across persist/load cycles.
// ═══════════════════════════════════════════════════════════════════════════

export function reviveDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value);
  return null;
}

export function reviveDates(value: unknown, keys: string[]): void {
  if (value === null || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const revived = reviveDate(record[key]);
    if (revived) record[key] = revived;
  }
}

export function reviveDateList(value: unknown): Date[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => reviveDate(item))
    .filter((d): d is Date => d !== null);
}
