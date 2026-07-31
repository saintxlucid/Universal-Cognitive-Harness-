const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

function parseVersion(version: string): ParsedVersion | null {
  const match = VERSION_RE.exec(version);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export function satisfiesSemver(version: string, range: string): boolean {
  const parsed = parseVersion(version);
  if (!parsed) return false;

  const trimmed = range.trim();
  if (trimmed === '*') return true;

  const caret = /^\^(\d+)\.(\d+)\.(\d+)/.exec(trimmed);
  if (caret) {
    const floor = { major: Number(caret[1]), minor: Number(caret[2]), patch: Number(caret[3]) };
    const ceiling = { major: floor.major + 1, minor: 0, patch: 0 };
    return compareVersions(parsed, floor) >= 0 && compareVersions(parsed, ceiling) < 0;
  }

  const tilde = /^~(\d+)\.(\d+)\.(\d+)/.exec(trimmed);
  if (tilde) {
    const floor = { major: Number(tilde[1]), minor: Number(tilde[2]), patch: Number(tilde[3]) };
    const ceiling = { major: floor.major, minor: floor.minor + 1, patch: 0 };
    return compareVersions(parsed, floor) >= 0 && compareVersions(parsed, ceiling) < 0;
  }

  const gte = /^>=(\d+)\.(\d+)\.(\d+)/.exec(trimmed);
  if (gte) {
    return compareVersions(parsed, { major: Number(gte[1]), minor: Number(gte[2]), patch: Number(gte[3]) }) >= 0;
  }

  const exact = parseVersion(trimmed);
  return exact !== null && compareVersions(parsed, exact) === 0;
}
