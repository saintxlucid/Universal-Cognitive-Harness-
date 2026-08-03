import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import type { MitigationResult, ThreatID, ThreatMitigation } from './types.js';

interface SessionBinding {
  sessionId: string;
  clientId: string;
  clientIdentity: string;
  lastVerified: number;
  isValid: boolean;
}

export class T14SessionHijackingMitigation implements ThreatMitigation {
  id = 'T14' as ThreatID;
  description =
    'Detect session token reuse from different client identities and force re-authentication';
  severity = 'high' as const;
  subsystem = 'auth';
  isActive = false;
  private sessionBindings: Map<string, SessionBinding> = new Map();
  private readonly verificationIntervalMs = 60000;
  private hijackedSessions: Set<string> = new Set();

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    for (const [, binding] of this.sessionBindings) {
      if (!binding.isValid) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const evidence: string[] = [];
    for (const [, binding] of this.sessionBindings) {
      if (!binding.isValid) {
        this.hijackedSessions.add(binding.sessionId);
        evidence.push(`session-invalidated:${binding.sessionId} client:${binding.clientIdentity}`);
      }
    }
    return {
      applied: evidence.length > 0,
      description: `Session hijacking mitigation: invalidated ${evidence.length} hijacked sessions`,
      evidence,
    };
  }

  registerSession(sessionId: string, clientId: string, clientIdentity: string): void {
    this.sessionBindings.set(sessionId, {
      sessionId,
      clientId,
      clientIdentity,
      lastVerified: Date.now(),
      isValid: true,
    });
  }

  verifySession(sessionId: string, clientIdentity: string): boolean {
    const binding = this.sessionBindings.get(sessionId);
    if (!binding) return false;
    if (binding.clientIdentity !== clientIdentity) {
      binding.isValid = false;
      return false;
    }
    binding.lastVerified = Date.now();
    return true;
  }

  isSessionValid(sessionId: string): boolean {
    const binding = this.sessionBindings.get(sessionId);
    if (!binding) return false;
    return binding.isValid;
  }

  getStats(): Record<string, unknown> {
    return {
      trackedSessions: this.sessionBindings.size,
      hijackedSessions: this.hijackedSessions.size,
    };
  }
}
