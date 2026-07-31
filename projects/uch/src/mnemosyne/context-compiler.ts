// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — Context compiler: the context engineering layer
// Letta-style typed memory blocks with token budgets, organized into banks
// (identity, user, workspace, codebase, session). Stable knowledge lives in
// banks loaded up-front; dynamic detail is pulled just-in-time via tools
// (progressive disclosure). Every bank reports token spend.
// ═══════════════════════════════════════════════════════════════════════════

import type { Bank, Block } from './types.js';

export type BankKind = 'identity' | 'user' | 'workspace' | 'codebase' | 'session';

export interface CompilerConfig {
  budgets: Record<BankKind, number>;
}

export const DEFAULT_COMPILER_CONFIG: CompilerConfig = {
  budgets: {
    identity: 400,
    user: 400,
    workspace: 600,
    codebase: 600,
    session: 300,
  },
};

export interface CompiledContext {
  banks: Bank[];
  tokens: number;
  budget: number;
  truncated: Record<BankKind, boolean>;
}

export class ContextCompiler {
  private banks = new Map<BankKind, Bank>();
  private config: CompilerConfig;

  constructor(config?: Partial<CompilerConfig>) {
    this.config = { budgets: { ...DEFAULT_COMPILER_CONFIG.budgets, ...(config?.budgets ?? {}) } };
    for (const kind of Object.keys(this.config.budgets) as BankKind[]) {
      this.banks.set(kind, { id: `bank-${kind}`, kind, budget: this.config.budgets[kind], blocks: [] });
    }
  }

  setBlock(kind: BankKind, label: string, content: string, updatedBy: Block['updatedBy'] = 'sleep'): Block {
    const bank = this.banks.get(kind)!;
    let block = bank.blocks.find((b) => b.label === label);
    if (block) {
      block.content = content;
      block.version++;
      block.updatedBy = updatedBy;
    } else {
      block = { id: `${bank.id}-${label}`, label, content, limit: this.config.budgets[kind], version: 1, updatedBy };
      bank.blocks.push(block);
    }
    this.trimBank(bank);
    return block;
  }

  getBlock(kind: BankKind, label: string): Block | undefined {
    return this.banks.get(kind)?.blocks.find((b) => b.label === label);
  }

  removeBlock(kind: BankKind, label: string): void {
    const bank = this.banks.get(kind);
    if (bank) bank.blocks = bank.blocks.filter((b) => b.label !== label);
  }

  /** Compile the in-context layer: banks in priority order, within budget. */
  compile(): CompiledContext {
    const order: BankKind[] = ['identity', 'user', 'workspace', 'codebase', 'session'];
    const out: Bank[] = [];
    let tokens = 0;
    const truncated: Record<BankKind, boolean> = { identity: false, user: false, workspace: false, codebase: false, session: false };
    let totalBudget = 0;

    for (const kind of order) {
      const bank = this.banks.get(kind)!;
      totalBudget += bank.budget;
      const rendered = this.renderBank(bank);
      const bankTokens = estimateTokens(rendered);
      if (tokens + bankTokens > this.config.budgets[kind] + tokens && bankTokens > 0) {
        truncated[kind] = true;
        const trimmed = this.trimToTokens(rendered, this.config.budgets[kind]);
        const trimmedBank: Bank = { ...bank, blocks: [{ id: `${bank.id}-truncated`, label: `${kind} (truncated)`, content: trimmed, limit: this.config.budgets[kind], version: 0, updatedBy: 'sleep' }] };
        tokens += estimateTokens(trimmed);
        out.push(trimmedBank);
        continue;
      }
      tokens += bankTokens;
      out.push(bank);
    }

    return { banks: out, tokens, budget: totalBudget, truncated };
  }

  /** Progressive disclosure: identifiers in context, details via tools. */
  indexOf(kind: BankKind): string {
    const bank = this.banks.get(kind);
    if (!bank) return '';
    return bank.blocks.map((b) => `${b.label} [${b.version}]`).join(', ');
  }

  stats(): Record<BankKind, { blocks: number; tokens: number }> {
    const out = {} as Record<BankKind, { blocks: number; tokens: number }>;
    for (const [kind, bank] of this.banks) {
      out[kind] = { blocks: bank.blocks.length, tokens: estimateTokens(this.renderBank(bank)) };
    }
    return out;
  }

  snapshot(): Bank[] {
    return [...this.banks.values()].map((b) => structuredClone(b));
  }

  restore(banks: Bank[]): void {
    this.banks.clear();
    for (const bank of banks) this.banks.set(bank.kind as BankKind, structuredClone(bank));
  }

  private trimBank(bank: Bank): void {
    const budget = this.config.budgets[bank.kind as BankKind];
    while (bank.blocks.length > 1 && estimateTokens(this.renderBank(bank)) > budget) {
      const lowest = bank.blocks.reduce((a, b) => (a.version < b.version ? a : b));
      bank.blocks = bank.blocks.filter((b) => b.id !== lowest.id);
    }
  }

  private renderBank(bank: Bank): string {
    if (bank.blocks.length === 1 && bank.blocks[0]?.label.endsWith('(truncated)')) return bank.blocks[0]!.content;
    return bank.blocks.map((b) => `## ${b.label}\n${b.content}`).join('\n\n');
  }

  private trimToTokens(text: string, budget: number): string {
    const tokens = estimateTokens(text);
    if (tokens <= budget) return text;
    const ratio = budget / tokens;
    const chars = Math.floor(text.length * ratio);
    return text.slice(0, Math.max(40, chars)) + '\n…';
  }
}

export function estimateTokens(text: string): number {
  return Math.max(0, Math.ceil(text.length / 4));
}
