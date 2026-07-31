import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TransactionalMemory,
  integrityGate,
  organicScoreGate,
  type GateVerdict,
  type VerificationGate,
} from '../kernel/transactional/index.js';

const T0 = new Date('2026-08-01T00:00:00.000Z');

function fixedClock(): { now: () => Date; tick: () => void } {
  let t = T0;
  return {
    now: () => t,
    tick: () => {
      t = new Date(t.getTime() + 1000);
    },
  };
}

function passGate(id: string): VerificationGate {
  return {
    id,
    verify(): GateVerdict {
      return { gateId: id, pass: true };
    },
  };
}

function failGate(id: string, reason = 'denied'): VerificationGate {
  return {
    id,
    verify(): GateVerdict {
      return { gateId: id, pass: false, reason };
    },
  };
}

const tmpDirs: string[] = [];

function tmpFile(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txn-'));
  tmpDirs.push(dir);
  return path.join(dir, name);
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('TransactionalMemory', () => {
  it('proposes with monotonic tx ids, proposed status, and injectable clock', () => {
    const { now } = fixedClock();
    const mem = new TransactionalMemory(now);

    const first = mem.propose('thought one');
    const second = mem.propose('thought two');

    expect(first.id).toBe('tx-1');
    expect(second.id).toBe('tx-2');
    expect(first.status).toBe('proposed');
    expect(first.proposal).toBe('thought one');
    expect(first.openedAt).toEqual(T0);
    expect(first.verdicts).toEqual([]);
  });

  it('commits when all gates pass and appends to committed', () => {
    const { now, tick } = fixedClock();
    const mem = new TransactionalMemory(now);
    const tx = mem.propose('sound idea');

    mem.verify(tx, [passGate('a'), passGate('b')]);
    tick();
    expect(mem.commit(tx)).toBe(true);

    expect(tx.status).toBe('committed');
    expect(tx.committedAt).toEqual(new Date(T0.getTime() + 1000));
    expect(mem.committed()).toEqual(['sound idea']);
  });

  it('refuses commit when any gate fails, then rollback succeeds', () => {
    const mem = new TransactionalMemory();
    const tx = mem.propose('risky idea');

    mem.verify(tx, [passGate('a'), failGate('b', 'violates constitution')]);

    expect(mem.commit(tx)).toBe(false);
    expect(mem.committed()).toEqual([]);
    expect(tx.status).toBe('proposed');
    expect(tx.verdicts.map((v) => v.gateId)).toEqual(['a', 'b']);

    expect(mem.rollback(tx)).toBe(true);
    expect(tx.status).toBe('rolled-back');
  });

  it('rollback on committed returns false', () => {
    const mem = new TransactionalMemory();
    const tx = mem.propose('done deal');

    mem.verify(tx, [passGate('a')]);
    expect(mem.commit(tx)).toBe(true);

    expect(mem.rollback(tx)).toBe(false);
    expect(tx.status).toBe('committed');
    expect(mem.committed()).toHaveLength(1);
  });

  it('double-commit is idempotently false', () => {
    const mem = new TransactionalMemory();
    const tx = mem.propose('idempotent');

    mem.verify(tx, [passGate('a')]);
    expect(mem.commit(tx)).toBe(true);
    expect(mem.commit(tx)).toBe(false);
    expect(mem.committed()).toEqual(['idempotent']);
  });

  it('commit after rollback returns false', () => {
    const mem = new TransactionalMemory();
    const tx = mem.propose('cancelled');

    expect(mem.rollback(tx)).toBe(true);
    expect(mem.commit(tx)).toBe(false);
  });

  it('consults all gates and preserves verdict order', () => {
    const calls: string[] = [];
    const gate = (id: string, pass = true): VerificationGate => ({
      id,
      verify(): GateVerdict {
        calls.push(id);
        return { gateId: id, pass };
      },
    });
    const mem = new TransactionalMemory();
    const tx = mem.propose('ordered');

    const verdicts = mem.verify(tx, [gate('alpha'), gate('beta'), gate('gamma')]);

    expect(calls).toEqual(['alpha', 'beta', 'gamma']);
    expect(verdicts.map((v) => v.gateId)).toEqual(['alpha', 'beta', 'gamma']);
    expect(tx.verdicts.map((v) => v.gateId)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('verify records verdicts on the transaction', () => {
    const mem = new TransactionalMemory();
    const tx = mem.propose('recorded');
    const verdicts = mem.verify(tx, [passGate('x'), failGate('y', 'no')]);

    expect(tx.verdicts).toEqual(verdicts);
    expect(verdicts).toHaveLength(2);
  });

  it('ledger is append-only in proposal order and returned as a copy', () => {
    const mem = new TransactionalMemory();
    const t1 = mem.propose('one');
    const t2 = mem.propose('two');
    const t3 = mem.propose('three');

    mem.verify(t1, [passGate('a')]);
    mem.commit(t1);
    mem.verify(t3, [passGate('a')]);
    mem.commit(t3);
    mem.rollback(t2);

    const ledger = mem.ledger();
    expect(ledger.map((t) => t.id)).toEqual(['tx-1', 'tx-2', 'tx-3']);
    expect(ledger.map((t) => t.status)).toEqual(['committed', 'rolled-back', 'committed']);
    expect(ledger[0]!.committedAt).toBeInstanceOf(Date);

    ledger.push(ledger[0]!);
    expect(mem.ledger()).toHaveLength(3);
  });

  it('persist/load round-trips state and carries the id counter', async () => {
    const { now, tick } = fixedClock();
    const mem = new TransactionalMemory(now);

    const good = mem.propose('good thought');
    mem.verify(good, [passGate('a'), passGate('b')]);
    tick();
    expect(mem.commit(good)).toBe(true);

    const bad = mem.propose('bad thought');
    mem.verify(bad, [failGate('a')]);
    expect(mem.rollback(bad)).toBe(true);

    const file = tmpFile('txn.json');
    await mem.persist(file);

    const restored = new TransactionalMemory(now);
    expect(await restored.load(file)).toBe(2);

    expect(restored.ledger()).toHaveLength(2);
    expect(restored.committed()).toEqual(['good thought']);
    const [ledgerGood, ledgerBad] = restored.ledger();
    expect(ledgerGood!.status).toBe('committed');
    expect(ledgerGood!.committedAt).toEqual(new Date(T0.getTime() + 1000));
    expect(ledgerGood!.verdicts.map((v) => v.gateId)).toEqual(['a', 'b']);
    expect(ledgerGood!.verdicts.every((v) => v.pass)).toBe(true);
    expect(ledgerBad!.status).toBe('rolled-back');
    expect(ledgerBad!.verdicts[0]!.pass).toBe(false);

    const next = restored.propose('next');
    expect(next.id).toBe('tx-3');
  });

  it('load on a missing file returns 0 and leaves state empty', async () => {
    const mem = new TransactionalMemory();
    expect(await mem.load(tmpFile('absent.json'))).toBe(0);
    expect(mem.ledger()).toEqual([]);
    expect(mem.propose('fresh').id).toBe('tx-1');
  });
});

describe('gate adapters', () => {
  it('integrityGate passes a fully qualified claim and fails an unqualified one', () => {
    const gate = integrityGate();

    const pass = gate.verify({
      claim: 'workspace X uses TypeScript',
      objective: true,
      qualifiedSource: true,
      wholeTruth: true,
      prejudice: false,
      propaganda: false,
    });
    expect(pass.pass).toBe(true);

    const fail = gate.verify('workspace X uses TypeScript');
    expect(fail.pass).toBe(false);
    expect(fail.reason).toContain('subjectivity');
  });

  it('integrityGate rejects proposals that are not integrity contexts', () => {
    const verdict = integrityGate().verify(42);
    expect(verdict.pass).toBe(false);
    expect(verdict.reason).toContain('claim');
  });

  it('organicScoreGate passes clean changes and rejects flagged ones', () => {
    const gate = organicScoreGate();

    const clean = gate.verify({
      change: 'Extract shared validation helper with tests',
      intent: 'hardening',
    });
    expect(clean.pass).toBe(true);

    const flagged = gate.verify('Set password = "hunter2" on connect');
    expect(flagged.pass).toBe(false);
    expect(flagged.reason).toContain('organic score');
  });

  it('organicScoreGate accepts plain string proposals and rejects others', () => {
    const gate = organicScoreGate();

    expect(gate.verify('Refactor duplicate logic into one function').pass).toBe(true);
    expect(gate.verify({ noChange: true }).pass).toBe(false);
  });
});
