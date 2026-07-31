import { writeSnapshot, readSnapshot, mapToRecord } from '../persistence/persistence-engine.js';

export type LawSeverity = 'immutable' | 'foundational' | 'advisory';

export interface CognitiveLaw {
  id: string;
  name: string;
  description: string;
  severity: LawSeverity;
  category: string;
  createdAt: Date;
  provenance: string;
  check?: string;
}

export interface ComplianceViolation {
  lawId: string;
  lawName: string;
  severity: LawSeverity;
  subject: string;
  details: string;
  timestamp: Date;
}

export class CognitiveConstitution {
  private laws: Map<string, CognitiveLaw> = new Map();
  private violations: ComplianceViolation[] = [];
  private immutable = true;

  constructor() {
    this.enactBuiltinLaws();
  }

  get immutableMode(): boolean {
    return this.immutable;
  }

  enact(law: Omit<CognitiveLaw, 'id' | 'createdAt'>): CognitiveLaw {
    const created: CognitiveLaw = {
      ...law,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    this.laws.set(created.id, created);
    return created;
  }

  amend(lawId: string, updates: Partial<Omit<CognitiveLaw, 'id' | 'createdAt' | 'severity'>>): boolean {
    const existing = this.laws.get(lawId);
    if (!existing) return false;
    if (existing.severity === 'immutable' && this.immutable) return false;
    Object.assign(existing, updates);
    return true;
  }

  repeal(lawId: string): boolean {
    const existing = this.laws.get(lawId);
    if (!existing) return false;
    if (existing.severity === 'immutable' && this.immutable) return false;
    return this.laws.delete(lawId);
  }

  getLaw(id: string): CognitiveLaw | undefined {
    return this.laws.get(id);
  }

  getByCategory(category: string): CognitiveLaw[] {
    return [...this.laws.values()].filter((l) => l.category === category);
  }

  getBySeverity(severity: LawSeverity): CognitiveLaw[] {
    return [...this.laws.values()].filter((l) => l.severity === severity);
  }

  getAll(): CognitiveLaw[] {
    return [...this.laws.values()];
  }

  checkCompliance(subject: string, context: Record<string, unknown>): ComplianceViolation[] {
    const found: ComplianceViolation[] = [];
    for (const [, law] of this.laws) {
      if (!law.check) continue;
      const violated = this.evaluateCheck(law.check, context);
      if (violated) {
        const v: ComplianceViolation = {
          lawId: law.id, lawName: law.name, severity: law.severity,
          subject, details: `Law "${law.name}" violated: ${law.check}`,
          timestamp: new Date(),
        };
        found.push(v);
        this.violations.push(v);
      }
    }
    return found;
  }

  getViolations(limit = 100): ComplianceViolation[] {
    return this.violations.slice(-limit);
  }

  getViolationsBySubject(subject: string): ComplianceViolation[] {
    return this.violations.filter((v) => v.subject === subject);
  }

  countViolations(): number {
    return this.violations.length;
  }

  clearViolations(): void {
    this.violations = [];
  }

  getStats(): { totalLaws: number; immutable: number; foundational: number; advisory: number; totalViolations: number; categories: Record<string, number> } {
    const categories: Record<string, number> = {};
    let immutable = 0, foundational = 0, advisory = 0;
    for (const [, l] of this.laws) {
      categories[l.category] = (categories[l.category] ?? 0) + 1;
      if (l.severity === 'immutable') immutable++;
      else if (l.severity === 'foundational') foundational++;
      else advisory++;
    }
    return {
      totalLaws: this.laws.size, immutable, foundational, advisory,
      totalViolations: this.violations.length, categories,
    };
  }

  private evaluateCheck(check: string, context: Record<string, unknown>): boolean {
    if (check.startsWith('provenance:')) {
      const key = check.slice(11);
      return !(key in context) || context[key] === null || context[key] === undefined;
    }
    if (check.startsWith('no_fabrication')) {
      return context.evidence === false;
    }
    if (check === 'no_workspace_mutation') {
      return context.workspaceMutation === true;
    }
    if (check === 'frugal_inference') {
      return context.frugalInference === false;
    }
    // Information Integrity Checklist: context flags name the violation condition.
    if (check.startsWith('integrity:')) {
      const key = check.slice('integrity:'.length);
      return context[key] === true;
    }
    // Clean Code Covenant: context flags name the violation condition.
    if (check.startsWith('covenant:')) {
      const key = check.slice('covenant:'.length);
      return context[key] === true;
    }
    return false;
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      laws: mapToRecord(this.laws),
      violations: this.violations,
      immutable: this.immutable,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      laws: Record<string, CognitiveLaw>;
      violations: ComplianceViolation[];
      immutable: boolean;
    }>(filePath);
    if (!data) return 0;

    this.violations = data.violations ?? [];
    this.immutable = data.immutable ?? true;

    // Merge loaded laws, skipping names that match builtin laws
    const builtinNames = new Set(
      [...this.laws.values()]
        .filter((l) => l.provenance === 'cognitive-constitution-builtin')
        .map((l) => l.name),
    );

    if (data.laws) {
      for (const [id, law] of Object.entries(data.laws)) {
        if (!builtinNames.has(law.name)) {
          this.laws.set(id, law as CognitiveLaw);
        }
      }
    }

    return this.laws.size;
  }

  private enactBuiltinLaws(): void {
    const builtins: Array<Omit<CognitiveLaw, 'id' | 'createdAt'>> = [
      {
        name: 'No Evidence Fabrication',
        description: 'Never fabricate evidence. Every claim must have a verifiable source.',
        severity: 'immutable', category: 'integrity',
        provenance: 'cognitive-constitution-builtin',
        check: 'no_fabrication',
      },
      {
        name: 'Coprocessor Workspace Isolation',
        description: 'No internal coprocessor may directly modify the workspace. Accelerators receive serializable input and return structured output; only the external Pilot writes code, edits files, or executes commands.',
        severity: 'immutable', category: 'accelerator',
        provenance: 'cognitive-constitution-builtin',
        check: 'no_workspace_mutation',
      },
      {
        name: 'Frugal Inference by Default',
        description: 'Trivial cognition must never trigger paid inference. The Cognitive Scheduler gates model calls behind a cognitive profile; deterministic coprocessors handle low-complexity work.',
        severity: 'foundational', category: 'accelerator',
        provenance: 'cognitive-constitution-builtin',
        check: 'frugal_inference',
      },
      {
        name: 'Provenance Requirement',
        description: 'Every learned fact must record its provenance (source, timestamp, agent).',
        severity: 'immutable', category: 'integrity',
        provenance: 'cognitive-constitution-builtin',
        check: 'provenance:provenance',
      },
      {
        name: 'Facts vs Hypotheses',
        description: 'Distinguish confirmed facts from hypotheses. Label each accordingly.',
        severity: 'foundational', category: 'epistemology',
        provenance: 'cognitive-constitution-builtin',
      },
      {
        name: 'Immutable History',
        description: 'Never mutate history. Append events and derive state from them.',
        severity: 'immutable', category: 'storage',
        provenance: 'cognitive-constitution-builtin',
      },
      {
        name: 'Decision Reproducibility',
        description: 'Keep every major decision explainable and reproducible.',
        severity: 'foundational', category: 'governance',
        provenance: 'cognitive-constitution-builtin',
      },
      {
        name: 'Compress into Understanding',
        description: 'Compress experience into understanding rather than storing endless transcripts.',
        severity: 'advisory', category: 'knowledge',
        provenance: 'cognitive-constitution-builtin',
      },
      {
        name: 'Preserve Project Identity',
        description: 'Preserve project identity, principles, and conventions across agent changes.',
        severity: 'foundational', category: 'identity',
        provenance: 'cognitive-constitution-builtin',
      },
      {
        name: 'Prefer Reusable Abstractions',
        description: 'Prefer reusable abstractions over duplicated knowledge and code.',
        severity: 'advisory', category: 'engineering',
        provenance: 'cognitive-constitution-builtin',
      },
      {
        name: 'Confidence Transparency',
        description: 'Every retrieved fact must include its confidence level.',
        severity: 'foundational', category: 'epistemology',
        provenance: 'cognitive-constitution-builtin',
      },
      {
        name: 'Provenance Preservation',
        description: 'Preserve provenance when transforming or compressing knowledge.',
        severity: 'foundational', category: 'knowledge',
        provenance: 'cognitive-constitution-builtin',
      },
      // === Information Integrity Checklist (ledger 5.4) ===
      {
        name: 'Objectivity Required',
        description: 'Information Integrity Checklist #1: no plan or claim may be grounded on a purely subjective assertion. Every claim must be objective — verifiable against workspace state or external evidence.',
        severity: 'immutable', category: 'integrity',
        provenance: 'cognitive-constitution-builtin',
        check: 'integrity:subjectivity',
      },
      {
        name: 'Qualified Source Required',
        description: 'Information Integrity Checklist #2: every sourced claim must carry a qualified source — identified, relevant, and competent for the claim. Unqualified sources must not gate decisions.',
        severity: 'immutable', category: 'integrity',
        provenance: 'cognitive-constitution-builtin',
        check: 'integrity:unqualified_source',
      },
      {
        name: 'No Prejudice as Evidence',
        description: 'Information Integrity Checklist #3: claims sourced from material showing evidence of prejudice must be flagged and cannot be treated as neutral evidence.',
        severity: 'foundational', category: 'integrity',
        provenance: 'cognitive-constitution-builtin',
        check: 'integrity:prejudice',
      },
      {
        name: 'No Propaganda as Evidence',
        description: 'Information Integrity Checklist #4: propagandistic material — intent to persuade rather than inform — is inadmissible as evidence for planning.',
        severity: 'immutable', category: 'integrity',
        provenance: 'cognitive-constitution-builtin',
        check: 'integrity:propaganda',
      },
      {
        name: 'Whole Truth Requirement',
        description: 'Information Integrity Checklist #5: a claim must represent the whole truth — omitting a material fact that reverses meaning is a violation.',
        severity: 'immutable', category: 'integrity',
        provenance: 'cognitive-constitution-builtin',
        check: 'integrity:omission',
      },
      // === Clean Code Covenant (ledger 4.5) ===
      {
        name: 'Separation of Concerns',
        description: 'Clean Code Covenant (SOC): each module owns one responsibility; cross-cutting concerns live in dedicated modules, not mixed into business logic.',
        severity: 'foundational', category: 'engineering',
        provenance: 'cognitive-constitution-builtin',
        check: 'covenant:soc_violation',
      },
      {
        name: 'Don\'t Repeat Yourself',
        description: 'Clean Code Covenant (DRY): duplication must be extracted into a shared abstraction; the same knowledge never lives in two places.',
        severity: 'foundational', category: 'engineering',
        provenance: 'cognitive-constitution-builtin',
        check: 'covenant:duplication',
      },
      {
        name: 'Keep It Simple',
        description: 'Clean Code Covenant (KISS): the simplest implementation that satisfies the contract wins; speculative complexity is a violation.',
        severity: 'foundational', category: 'engineering',
        provenance: 'cognitive-constitution-builtin',
        check: 'covenant:complexity',
      },
      {
        name: 'Document Your Code',
        description: 'Clean Code Covenant (DYC): intent that is not visible from the code itself must be documented; undocumented non-obvious logic is a violation.',
        severity: 'advisory', category: 'engineering',
        provenance: 'cognitive-constitution-builtin',
        check: 'covenant:undocumented',
      },
      {
        name: 'You Aren\'t Gonna Need It',
        description: 'Clean Code Covenant (YAGNI): generality with no current consumer is a violation; build for today\'s contract, refactor for tomorrow\'s.',
        severity: 'advisory', category: 'engineering',
        provenance: 'cognitive-constitution-builtin',
        check: 'covenant:unused_generality',
      },
    ];

    for (const law of builtins) {
      this.enact(law);
    }
  }
}
