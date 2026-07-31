import {
  type EnergyAllocation,
  type ComponentBudget,
  type MetabolicCost,
  zeroAllocation,
  subtractAllocation,
  canAfford,
} from './metabolic-profile.js';
import type { NervousSystemLayer } from '../nervous-system/signal.js';
import { type EconomicProposal, type Confidence, type Timestamp, timestamp, confidence } from '../shared/branded-types.js';

// ── Economic Constants ─────────────────────────────────────

const MIN_ROI_THRESHOLD = 0.1;
const PREEMPTION_ROI_MULTIPLIER = 2.0;
const STRATEGIC_RESERVE_RATIO = 0.1;

interface PendingProposal {
  proposal: EconomicProposal;
  componentId: string;
  submittedAt: Timestamp;
}

export interface MetabolismConfig {
  defaultBudget: EnergyAllocation;
  tickIntervalMs: number;
  starvationThreshold: number;
  minRoiThreshold?: number;
  enableEconomicScheduling?: boolean;
}

export interface BudgetOverride {
  componentId: string;
  budget: Partial<EnergyAllocation>;
  reason: string;
}

export class Metabolism {
  private budgets: Map<string, ComponentBudget> = new Map();
  private overrides: Map<string, BudgetOverride> = new Map();
  private energyLog: Array<{ componentId: string; cost: EnergyAllocation; operation: string; timestamp: number }> = [];
  private readonly config: Required<MetabolismConfig>;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private starvedComponents: string[] = [];
  private pendingProposals: PendingProposal[] = [];
  private activeOperation: { componentId: string; proposal: EconomicProposal; startedAt: Timestamp } | null = null;
  private totalRoiSpent = 0;
  private totalOperationsRejected = 0;

  constructor(config?: Partial<MetabolismConfig>) {
    this.config = {
      defaultBudget: config?.defaultBudget ?? {
        cpu: 1000,
        memory: 1024 * 1024 * 100,
        tokens: 100000,
        latency: 30000,
        storage: 1024 * 1024,
        network: 1024 * 1024 * 10,
      },
      tickIntervalMs: config?.tickIntervalMs ?? 60000,
      starvationThreshold: config?.starvationThreshold ?? 0.1,
      minRoiThreshold: config?.minRoiThreshold ?? MIN_ROI_THRESHOLD,
      enableEconomicScheduling: config?.enableEconomicScheduling ?? true,
    };
  }

  registerComponent(componentId: string, budget?: Partial<EnergyAllocation>): void {
    const base = { ...this.config.defaultBudget };
    if (budget) {
      Object.assign(base, budget);
    }
    this.budgets.set(componentId, {
      componentId,
      allocated: base,
      consumed: zeroAllocation(),
      remaining: { ...base },
    });
  }

  unregisterComponent(componentId: string): void {
    this.budgets.delete(componentId);
    this.overrides.delete(componentId);
  }

  applyOverride(override: BudgetOverride): void {
    this.overrides.set(override.componentId, override);
    const budget = this.budgets.get(override.componentId);
    if (budget) {
      Object.assign(budget.allocated, override.budget);
      budget.remaining = subtractAllocation(budget.allocated, budget.consumed);
    }
  }

  removeOverride(componentId: string): void {
    this.overrides.delete(componentId);
  }

  // ── Economic Proposal System ──────────────────────────────

  private normalizedCost(cost: EnergyAllocation): number {
    return (cost.cpu / this.config.defaultBudget.cpu +
      cost.memory / this.config.defaultBudget.memory +
      cost.tokens / this.config.defaultBudget.tokens +
      cost.latency / this.config.defaultBudget.latency +
      cost.storage / this.config.defaultBudget.storage) / 5;
  }

  private computeROI(proposal: EconomicProposal): number {
    const costNorm = this.normalizedCost(proposal.cost);
    if (costNorm <= 0) return 0;
    return (Number(proposal.expectedBenefit) * Number(proposal.confidence)) / (costNorm * (1 + Number(proposal.risk)));
  }

  propose(componentId: string, proposal: EconomicProposal): boolean {
    if (!this.config.enableEconomicScheduling) return true;

    const roi = this.computeROI(proposal);
    if (roi < this.config.minRoiThreshold) {
      this.totalOperationsRejected++;
      return false;
    }

    // Check if we have budget remaining
    const budget = this.budgets.get(componentId);
    if (!budget) return false;

    // Reserve check — keep strategic reserve for executive
    const reserveRatio = this.getReserveRatio();
    if (reserveRatio < STRATEGIC_RESERVE_RATIO && componentId !== 'executive') {
      // Queue for later
      this.pendingProposals.push({ proposal, componentId, submittedAt: timestamp(Date.now()) });
      return false;
    }

    // Preemption check — does this beat the current operation?
    if (this.activeOperation && roi > this.activeOperation.proposal.roi * PREEMPTION_ROI_MULTIPLIER) {
      // Preempt: current stays in budget, new one starts
      this.pendingProposals.push({
        proposal: this.activeOperation.proposal,
        componentId: this.activeOperation.componentId,
        submittedAt: this.activeOperation.startedAt,
      });
    }

    this.activeOperation = { componentId, proposal, startedAt: timestamp(Date.now()) };
    this.totalRoiSpent += roi;
    return true;
  }

  private getReserveRatio(): number {
    const totalBudget = this.getAllBudgets().reduce((sum, b) => {
      return sum + b.remaining.cpu / this.config.defaultBudget.cpu;
    }, 0);
    const totalAllocated = this.budgets.size;
    return totalAllocated > 0 ? totalBudget / totalAllocated : 1;
  }

  getPendingProposals(): PendingProposal[] {
    return [...this.pendingProposals]
      .sort((a, b) => {
        const roiA = this.computeROI(a.proposal);
        const roiB = this.computeROI(b.proposal);
        return roiB - roiA;
      });
  }

  flushPendingProposals(): number {
    const flushed = [...this.pendingProposals];
    this.pendingProposals = [];
    return flushed.length;
  }

  // ── Budget Consumption (gated by economic proposal) ───────

  consume(componentId: string, cost: Partial<EnergyAllocation>, operation: string): boolean {
    const budget = this.budgets.get(componentId);
    if (!budget) return false;

    const costFull: EnergyAllocation = {
      cpu: cost.cpu ?? 0,
      memory: cost.memory ?? 0,
      tokens: cost.tokens ?? 0,
      latency: cost.latency ?? 0,
      storage: cost.storage ?? 0,
      network: cost.network ?? 0,
    };

    if (!canAfford(budget.remaining, costFull)) return false;

    budget.consumed.cpu += costFull.cpu;
    budget.consumed.memory += costFull.memory;
    budget.consumed.tokens += costFull.tokens;
    budget.consumed.latency += costFull.latency;
    budget.consumed.storage += costFull.storage;
    budget.consumed.network += costFull.network;

    budget.remaining = subtractAllocation(budget.allocated, budget.consumed);

    this.energyLog.push({
      componentId,
      cost: costFull,
      operation,
      timestamp: Date.now(),
    });

    if (this.energyLog.length > 10000) this.energyLog.shift();

    return true;
  }

  getStatus(componentId: string): ComponentBudget | null {
    return this.budgets.get(componentId) ?? null;
  }

  getAllBudgets(): ComponentBudget[] {
    return [...this.budgets.values()];
  }

  getStarvedComponents(): string[] {
    return [...this.starvedComponents];
  }

  start(): void {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.refresh(), this.config.tickIntervalMs);
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private refresh(): void {
    this.starvedComponents = [];
    for (const [, budget] of this.budgets) {
      const usageRatio =
        (budget.consumed.cpu / budget.allocated.cpu +
          budget.consumed.memory / budget.allocated.memory +
          budget.consumed.tokens / budget.allocated.tokens) / 3;

      if (usageRatio > 1 - this.config.starvationThreshold) {
        this.starvedComponents.push(budget.componentId);
      }

      budget.consumed = zeroAllocation();
      budget.remaining = { ...budget.allocated };
    }
  }

  getEnergyLogs(count = 100): Array<{ componentId: string; cost: EnergyAllocation; operation: string; timestamp: number }> {
    return this.energyLog.slice(-count);
  }

  getStats(): Record<string, unknown> {
    const total: EnergyAllocation = zeroAllocation();
    for (const [, budget] of this.budgets) {
      total.cpu += budget.consumed.cpu;
      total.memory += budget.consumed.memory;
      total.tokens += budget.consumed.tokens;
      total.latency += budget.consumed.latency;
      total.storage += budget.consumed.storage;
      total.network += budget.consumed.network;
    }

    return {
      registeredComponents: this.budgets.size,
      starvedComponents: this.starvedComponents.length,
      totalConsumed: total,
      logEntries: this.energyLog.length,
      overrides: this.overrides.size,
      economicScheduling: this.config.enableEconomicScheduling,
      pendingProposals: this.pendingProposals.length,
      operationsRejected: this.totalOperationsRejected,
      totalRoiSpent: this.totalRoiSpent,
      activeOperation: this.activeOperation?.proposal.operation ?? null,
    };
  }
}
