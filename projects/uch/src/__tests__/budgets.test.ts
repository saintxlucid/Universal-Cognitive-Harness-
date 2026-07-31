import { describe, it, expect } from 'vitest';
import { BudgetTracker } from '../control-plane/budgets/budgets.js';

describe('BudgetTracker', () => {
  it('allows operations within budget', () => {
    const budgets = new BudgetTracker({ maxTokensPerDay: 1000 });
    const result = budgets.check('agent-1', 'session-1', 100, 0.01);
    expect(result.allowed).toBe(true);
  });

  it('denies when daily token budget exceeded', () => {
    const budgets = new BudgetTracker({ maxTokensPerDay: 500 });
    budgets.check('agent-1', 'session-1', 400, 0.01);
    budgets.record({ agentId: 'agent-1', sessionId: 'session-1', timestamp: new Date(), tokensUsed: 400, cost: 0.01, toolCalls: 1, operation: 'test' });

    const result = budgets.check('agent-1', 'session-1', 200, 0.01);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Daily token budget exceeded');
  });

  it('denies when daily cost budget exceeded', () => {
    const budgets = new BudgetTracker({ maxCostPerDay: 1.0 });
    budgets.record({ agentId: 'agent-1', sessionId: 's1', timestamp: new Date(), tokensUsed: 100, cost: 0.9, toolCalls: 1, operation: 'test' });

    const result = budgets.check('agent-1', 's1', 100, 0.2);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Daily cost budget exceeded');
  });

  it('denies when session tool call budget exceeded', () => {
    const budgets = new BudgetTracker({ maxToolCallsPerSession: 2 });
    budgets.record({ agentId: 'agent-1', sessionId: 's1', timestamp: new Date(), tokensUsed: 10, cost: 0, toolCalls: 2, operation: 'test' });

    const result = budgets.check('agent-1', 's1', 10, 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('tool call budget exceeded');
  });

  it('respects per-agent budgets', () => {
    const budgets = new BudgetTracker({
      agentBudgets: { 'agent-1': { maxTokensPerDay: 100, maxCostPerDay: 1, maxToolCallsPerSession: 10 } },
    });
    budgets.record({ agentId: 'agent-1', sessionId: 's1', timestamp: new Date(), tokensUsed: 80, cost: 0, toolCalls: 1, operation: 'test' });

    expect(budgets.check('agent-1', 's1', 30, 0).allowed).toBe(false);
    expect(budgets.check('agent-2', 's1', 30, 0).allowed).toBe(true);
  });

  it('returns current state', () => {
    const budgets = new BudgetTracker({ maxTokensPerDay: 1000 });
    budgets.record({ agentId: 'agent-1', sessionId: 's1', timestamp: new Date(), tokensUsed: 200, cost: 0.5, toolCalls: 3, operation: 'test' });

    const state = budgets.getState('agent-1', 's1');
    expect(state.tokensUsedToday).toBe(200);
    expect(state.costIncurredToday).toBe(0.5);
    expect(state.tokensUsedThisSession).toBe(200);
    expect(state.toolCallsThisSession).toBe(3);
  });

  it('resets session state', () => {
    const budgets = new BudgetTracker();
    budgets.record({ agentId: 'agent-1', sessionId: 's1', timestamp: new Date(), tokensUsed: 100, cost: 0, toolCalls: 1, operation: 'test' });
    budgets.resetSession('s1');

    const state = budgets.getState('agent-1', 's1');
    expect(state.tokensUsedThisSession).toBe(0);
  });

  it('resets daily state', () => {
    const budgets = new BudgetTracker();
    budgets.record({ agentId: 'agent-1', sessionId: 's1', timestamp: new Date(), tokensUsed: 100, cost: 0, toolCalls: 1, operation: 'test' });
    budgets.resetDaily('agent-1');

    expect(budgets.getState('agent-1', 's1').tokensUsedToday).toBe(0);
  });

  it('maintains usage log', () => {
    const budgets = new BudgetTracker();
    budgets.record({ agentId: 'agent-1', sessionId: 's1', timestamp: new Date(), tokensUsed: 100, cost: 0, toolCalls: 1, operation: 'infer' });
    budgets.record({ agentId: 'agent-2', sessionId: 's2', timestamp: new Date(), tokensUsed: 50, cost: 0, toolCalls: 2, operation: 'search' });

    const log = budgets.getUsageLog();
    expect(log).toHaveLength(2);
  });
});
