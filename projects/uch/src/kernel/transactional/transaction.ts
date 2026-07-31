import {
  IntegrityChecklist,
  type IntegrityContext,
} from '../../cognitive-plane/integrity/integrity-checklist.js';
import {
  OrganicScoreEngine,
  type OrganicScoreInput,
} from '../constitution/organic-score.js';
import {
  readSnapshot,
  writeSnapshot,
  type Storable,
} from '../../cognitive-plane/persistence/persistence-engine.js';
import type { Clock, GateVerdict, Transaction, VerificationGate } from './types.js';

interface TransactionalSnapshot {
  nextId: number;
  transactions: Transaction[];
  committed: unknown[];
}

export class TransactionalMemory implements Storable {
  private transactions = new Map<string, Transaction>();
  private ledgerEntries: Transaction[] = [];
  private committedItems: unknown[] = [];
  private nextId = 1;
  private now: Clock;

  constructor(now?: Clock) {
    this.now = now ?? (() => new Date());
  }

  propose(proposal: unknown): Transaction {
    const tx: Transaction = {
      id: `tx-${this.nextId}`,
      proposal,
      status: 'proposed',
      openedAt: this.now(),
      verdicts: [],
    };
    this.nextId += 1;
    this.transactions.set(tx.id, tx);
    this.ledgerEntries.push(tx);
    return tx;
  }

  verify(tx: Transaction, gates: VerificationGate[]): GateVerdict[] {
    const verdicts = gates.map((gate) => gate.verify(tx.proposal));
    tx.verdicts = verdicts;
    return verdicts;
  }

  commit(tx: Transaction): boolean {
    if (tx.status !== 'proposed') return false;
    if (tx.verdicts.some((v) => !v.pass)) return false;
    tx.status = 'committed';
    tx.committedAt = this.now();
    this.committedItems.push(tx.proposal);
    return true;
  }

  rollback(tx: Transaction): boolean {
    if (tx.status !== 'proposed') return false;
    tx.status = 'rolled-back';
    return true;
  }

  committed(): unknown[] {
    return [...this.committedItems];
  }

  ledger(): Transaction[] {
    return [...this.ledgerEntries];
  }

  async persist(filePath: string): Promise<void> {
    const snapshot: TransactionalSnapshot = {
      nextId: this.nextId,
      transactions: [...this.transactions.values()],
      committed: this.committedItems,
    };
    writeSnapshot(filePath, snapshot);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<TransactionalSnapshot>(filePath);
    if (!data) return 0;
    this.nextId = data.nextId;
    this.transactions = new Map<string, Transaction>();
    for (const tx of data.transactions ?? []) this.transactions.set(tx.id, tx);
    // Ledger entries are appended at propose time; statuses mutate in place,
    // so restore order by re-appending the persisted records in file order.
    this.ledgerEntries = [...(data.transactions ?? [])];
    this.committedItems = data.committed ?? [];
    return this.ledgerEntries.length;
  }
}

function integrityContextFor(proposal: unknown): IntegrityContext | null {
  if (typeof proposal === 'string') return { claim: proposal };
  if (typeof proposal === 'object' && proposal !== null) {
    const maybe = proposal as { claim?: unknown };
    if (typeof maybe.claim === 'string') return proposal as IntegrityContext;
  }
  return null;
}

export function integrityGate(checklist?: IntegrityChecklist): VerificationGate {
  const engine = checklist ?? new IntegrityChecklist();
  return {
    id: 'integrity-checklist',
    verify(proposal: unknown): GateVerdict {
      const context = integrityContextFor(proposal);
      if (!context) {
        return {
          gateId: 'integrity-checklist',
          pass: false,
          reason: 'proposal is not an integrity context (needs a claim)',
        };
      }
      const result = engine.evaluate(context);
      return {
        gateId: 'integrity-checklist',
        pass: result.passed,
        reason: result.passed
          ? undefined
          : result.issues.map((issue) => `${issue.flag}: ${issue.detail}`).join('; '),
      };
    },
  };
}

function organicScoreInputFor(proposal: unknown): OrganicScoreInput | null {
  if (typeof proposal === 'string') return { change: proposal };
  if (typeof proposal === 'object' && proposal !== null) {
    const maybe = proposal as { change?: unknown };
    if (typeof maybe.change === 'string') return proposal as OrganicScoreInput;
  }
  return null;
}

export function organicScoreGate(engine?: OrganicScoreEngine): VerificationGate {
  const scorer = engine ?? new OrganicScoreEngine();
  return {
    id: 'organic-score',
    verify(proposal: unknown): GateVerdict {
      const input = organicScoreInputFor(proposal);
      if (!input) {
        return {
          gateId: 'organic-score',
          pass: false,
          reason: 'proposal is not an organic-score input (needs change text)',
        };
      }
      const result = scorer.evaluate(input);
      return {
        gateId: 'organic-score',
        pass: result.verdict === 'pass',
        reason: result.verdict === 'pass'
          ? undefined
          : `organic score ${result.score} (${result.verdict})`,
      };
    },
  };
}
