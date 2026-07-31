export type TimelineEventType =
  | 'workspace:created'
  | 'workspace:scanned'
  | 'commit'
  | 'release'
  | 'decision'
  | 'architecture:change'
  | 'dependency:change'
  | 'refactor'
  | 'incident'
  | 'milestone'
  | 'agent:joined'
  | 'agent:departed';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: Date;
  title: string;
  description: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export class WorkspaceTimeline {
  private events: TimelineEvent[] = [];
  private indexByType: Map<TimelineEventType, string[]> = new Map();

  addEvent(event: Omit<TimelineEvent, 'id'>): TimelineEvent {
    const full: TimelineEvent = { ...event, id: crypto.randomUUID() };
    this.events.push(full);

    const typeIndex = this.indexByType.get(event.type) ?? [];
    typeIndex.push(full.id);
    this.indexByType.set(event.type, typeIndex);

    return full;
  }

  getRecent(count = 20): TimelineEvent[] {
    return [...this.events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, count);
  }

  getByType(type: TimelineEventType): TimelineEvent[] {
    const ids = this.indexByType.get(type) ?? [];
    return ids.map((id) => this.events.find((e) => e.id === id)).filter((e): e is TimelineEvent => e !== undefined);
  }

  getByTimeRange(start: Date, end: Date): TimelineEvent[] {
    return this.events.filter((e) => e.timestamp >= start && e.timestamp <= end);
  }

  getEventCount(): number {
    return this.events.length;
  }
}
