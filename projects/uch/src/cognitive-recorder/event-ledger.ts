import type { CognitiveActivity, ActivityType } from './cognitive-activity.js';

export interface LedgerStats {
  total_activities: number;
  by_type: Record<string, number>;
  by_agent: Record<string, number>;
  time_range: { earliest: Date | null; latest: Date | null };
  bytes_approximate: number;
}

interface LedgerIndexEntry {
  activity_id: string;
  timestamp: Date;
  type: ActivityType;
  session_id: string;
  agent_id: string;
  trace_id: string;
}

export class EventLedger {
  private activities: Map<string, CognitiveActivity> = new Map();
  private index: LedgerIndexEntry[] = [];

  update(activityId: string, updates: Partial<CognitiveActivity>): boolean {
    const existing = this.activities.get(activityId);
    if (!existing) return false;
    this.activities.set(activityId, { ...existing, ...updates, id: activityId });
    return true;
  }

  append(activity: CognitiveActivity): string {
    this.activities.set(activity.id, { ...activity });
    this.index.push({
      activity_id: activity.id,
      timestamp: activity.timestamp,
      type: activity.type,
      session_id: activity.context.session_id,
      agent_id: activity.context.agent_id,
      trace_id: activity.trace_id ?? '',
    });
    return activity.id;
  }

  getById(id: string): CognitiveActivity | undefined {
    return this.activities.get(id);
  }

  getByTimeRange(start: Date, end: Date): CognitiveActivity[] {
    return this.index
      .filter((e) => e.timestamp >= start && e.timestamp <= end)
      .map((e) => this.activities.get(e.activity_id))
      .filter((a): a is CognitiveActivity => a !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getByType(type: ActivityType): CognitiveActivity[] {
    return this.index
      .filter((e) => e.type === type)
      .map((e) => this.activities.get(e.activity_id))
      .filter((a): a is CognitiveActivity => a !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getBySession(sessionId: string): CognitiveActivity[] {
    return this.index
      .filter((e) => e.session_id === sessionId)
      .map((e) => this.activities.get(e.activity_id))
      .filter((a): a is CognitiveActivity => a !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getByAgent(agentId: string): CognitiveActivity[] {
    return this.index
      .filter((e) => e.agent_id === agentId)
      .map((e) => this.activities.get(e.activity_id))
      .filter((a): a is CognitiveActivity => a !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getByTrace(traceId: string): CognitiveActivity[] {
    return this.index
      .filter((e) => e.trace_id === traceId)
      .map((e) => this.activities.get(e.activity_id))
      .filter((a): a is CognitiveActivity => a !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getRecent(limit = 50): CognitiveActivity[] {
    const sorted = [...this.index].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return sorted
      .slice(0, limit)
      .map((e) => this.activities.get(e.activity_id))
      .filter((a): a is CognitiveActivity => a !== undefined);
  }

  getChildren(parentId: string): CognitiveActivity[] {
    const results: CognitiveActivity[] = [];
    for (const [, activity] of this.activities) {
      if (activity.parent_id === parentId) {
        results.push(activity);
      }
    }
    return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getTraceRoot(traceId: string): CognitiveActivity | undefined {
    for (const [, activity] of this.activities) {
      if (activity.trace_id === traceId && !activity.parent_id) {
        return activity;
      }
    }
    return undefined;
  }

  count(): number {
    return this.activities.size;
  }

  getStats(): LedgerStats {
    const byType: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    let earliest: Date | null = null;
    let latest: Date | null = null;

    for (const [, activity] of this.activities) {
      byType[activity.type] = (byType[activity.type] ?? 0) + 1;
      byAgent[activity.context.agent_id] = (byAgent[activity.context.agent_id] ?? 0) + 1;
      if (!earliest || activity.timestamp < earliest) earliest = activity.timestamp;
      if (!latest || activity.timestamp > latest) latest = activity.timestamp;
    }

    return {
      total_activities: this.activities.size,
      by_type: byType,
      by_agent: byAgent,
      time_range: { earliest, latest },
      bytes_approximate: JSON.stringify([...this.activities.values()]).length,
    };
  }

  async *stream(from?: Date): AsyncIterable<CognitiveActivity> {
    const sorted = [...this.index].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    for (const entry of sorted) {
      if (from && entry.timestamp < from) continue;
      const activity = this.activities.get(entry.activity_id);
      if (activity) {
        yield activity;
      }
    }
  }
}
