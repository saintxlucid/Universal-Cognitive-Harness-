import { CP_OPS } from '../../protocol/index.js';
import { DEFAULT_GRANT_OPERATIONS, STANDARD_CAPABILITIES } from '../../workspace-manifest/attach.js';

/**
 * The default effective capability set granted by the substrate to package
 * installs: the standard workspace capabilities, the attachment grant's
 * operation families, and the CIC operation vocabulary (bare, scoped to the
 * workspace, and scoped to the session) — the vocabulary Cognitive Packages
 * declare in `capabilities` (COGNITIVE-PACKAGES.md §3).
 */
export function defaultGrantedCapabilities(extra?: string[]): Set<string> {
  const set = new Set<string>([...STANDARD_CAPABILITIES, ...DEFAULT_GRANT_OPERATIONS]);
  const scopes = ['workspace', 'session', 'cognitive-state'];
  for (const op of CP_OPS) {
    set.add(op);
    for (const scope of scopes) {
      set.add(`${op}:${scope}`);
    }
  }
  for (const capability of extra ?? []) {
    set.add(capability);
  }
  return set;
}
