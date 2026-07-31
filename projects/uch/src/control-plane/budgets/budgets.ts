export interface BudgetConfig {
  maxTokensPerDay?: number;
  maxTokensPerSession?: number;
  maxCostPerDay?: number;
  maxToolCallsPerSession?: number;
  agentBudgets?: Record<string, AgentBudgetConfig>;
}

export interface AgentBudgetConfig {
  maxTokensPerDay: number;
  maxCostPerDay: number;
  maxToolCallsPerSession: number;
}

export interface BudgetState {
  tokensUsedToday: number;
  costIncurredToday: number;
  tokensUsedThisSession: number;
  toolCallsThisSession: number;
  dailyReset: string;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  current: BudgetState;
}

export interface UsageRecord {
  agentId: string;
  sessionId: string;
  timestamp: Date;
  tokensUsed: number;
  cost: number;
  toolCalls: number;
  operation: string;
}

export class BudgetTracker {
  private globalConfig: Required<BudgetConfig>;
  private dailyUsage: Map<string, { tokens: number; cost: number }> = new Map();
  private sessionUsage: Map<string, { tokens: number; cost: number; toolCalls: number }> = new Map();
  private usageLog: UsageRecord[] = [];
  private lastDailyReset: string;

  constructor(config?: BudgetConfig) {
    this.globalConfig = {
      maxTokensPerDay: config?.maxTokensPerDay ?? 1_000_000,
      maxTokensPerSession: config?.maxTokensPerSession ?? 100_000,
      maxCostPerDay: config?.maxCostPerDay ?? 50.0,
      maxToolCallsPerSession: config?.maxToolCallsPerSession ?? 1000,
      agentBudgets: config?.agentBudgets ?? {},
    };
    this.lastDailyReset = new Date().toISOString().split('T')[0]!;
  }

  check(agentId: string, sessionId: string, estimatedTokens: number, estimatedCost: number): BudgetCheckResult {
    this.maybeResetDaily();

    const now = new Date().toISOString().split('T')[0]!;

    const daily = this.dailyUsage.get(agentId) ?? { tokens: 0, cost: 0 };
    const session = this.sessionUsage.get(sessionId) ?? { tokens: 0, cost: 0, toolCalls: 0 };

    const agentBudget = this.globalConfig.agentBudgets[agentId];

    const maxDailyTokens = agentBudget?.maxTokensPerDay ?? this.globalConfig.maxTokensPerDay;
    const maxDailyCost = agentBudget?.maxCostPerDay ?? this.globalConfig.maxCostPerDay;

    if (daily.tokens + estimatedTokens > maxDailyTokens) {
      return { allowed: false, reason: `Daily token budget exceeded (${daily.tokens + estimatedTokens}/${maxDailyTokens})`, current: this.getState(agentId, sessionId) };
    }
    if (daily.cost + estimatedCost > maxDailyCost) {
      return { allowed: false, reason: `Daily cost budget exceeded ($${(daily.cost + estimatedCost).toFixed(2)}/$${maxDailyCost.toFixed(2)})`, current: this.getState(agentId, sessionId) };
    }
    if (session.tokens + estimatedTokens > this.globalConfig.maxTokensPerSession) {
      return { allowed: false, reason: `Session token budget exceeded`, current: this.getState(agentId, sessionId) };
    }
    if (session.toolCalls + 1 > (agentBudget?.maxToolCallsPerSession ?? this.globalConfig.maxToolCallsPerSession)) {
      return { allowed: false, reason: `Session tool call budget exceeded`, current: this.getState(agentId, sessionId) };
    }

    return { allowed: true, current: this.getState(agentId, sessionId) };
  }

  record(record: UsageRecord): void {
    const now = new Date().toISOString().split('T')[0]!;
    this.maybeResetDaily();

    const daily = this.dailyUsage.get(record.agentId) ?? { tokens: 0, cost: 0 };
    daily.tokens += record.tokensUsed;
    daily.cost += record.cost;
    this.dailyUsage.set(record.agentId, daily);

    const session = this.sessionUsage.get(record.sessionId) ?? { tokens: 0, cost: 0, toolCalls: 0 };
    session.tokens += record.tokensUsed;
    session.cost += record.cost;
    session.toolCalls += record.toolCalls;
    this.sessionUsage.set(record.sessionId, session);

    this.usageLog.push(record);
    if (this.usageLog.length > 10000) this.usageLog.shift();
  }

  getState(agentId: string, sessionId: string): BudgetState {
    this.maybeResetDaily();
    const daily = this.dailyUsage.get(agentId) ?? { tokens: 0, cost: 0 };
    const session = this.sessionUsage.get(sessionId) ?? { tokens: 0, cost: 0, toolCalls: 0 };

    return {
      tokensUsedToday: daily.tokens,
      costIncurredToday: daily.cost,
      tokensUsedThisSession: session.tokens,
      toolCallsThisSession: session.toolCalls,
      dailyReset: this.lastDailyReset,
    };
  }

  getUsageLog(limit = 100): UsageRecord[] {
    return this.usageLog.slice(-limit);
  }

  resetSession(sessionId: string): void {
    this.sessionUsage.delete(sessionId);
  }

  resetDaily(agentId?: string): void {
    if (agentId) {
      this.dailyUsage.delete(agentId);
    } else {
      this.dailyUsage.clear();
    }
    this.lastDailyReset = new Date().toISOString().split('T')[0]!;
  }

  private maybeResetDaily(): void {
    const today = new Date().toISOString().split('T')[0]!;
    if (today !== this.lastDailyReset) {
      this.dailyUsage.clear();
      this.lastDailyReset = today;
    }
  }
}
