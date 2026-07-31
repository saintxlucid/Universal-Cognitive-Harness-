import type { NeuralEvent } from '../event-bus/neural-event-bus.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { EventLedger } from './event-ledger.js';
import { createActivity, completeActivity, type CognitiveActivity, type ActivityType, type ActivityContext } from './cognitive-activity.js';
import { createProvenance } from '../kernel/types/provenance.js';

const EVENT_TO_ACTIVITY: Record<string, ActivityType> = {
  'file:opened': 'observe',
  'file:saved': 'observe',
  'file:created': 'observe',
  'file:deleted': 'observe',
  'git:commit': 'commit',
  'prompt:sent': 'converse',
  'prompt:responded': 'converse',
  'tool:called': 'execute',
  'tool:result': 'execute',
  'test:passed': 'test',
  'test:failed': 'test',
  'test:started': 'test',
  'build:started': 'build',
  'build:finished': 'build',
  'build:failed': 'build',
  'sleep:cycle': 'sleep',
  'consolidation:completed': 'consolidate',
  'prediction:made': 'predict',
  'prediction:failed': 'predict',
  'agent:attached': 'observe',
  'agent:detached': 'observe',
  'session:started': 'observe',
  'session:ended': 'observe',
  'error:occurred': 'observe',
  'error:handled': 'observe',
};

export class Recorder {
  readonly ledger: EventLedger;
  private eventBus: NeuralEventBus;
  private unsubscribers: string[] = [];
  private activeActivities: Map<string, CognitiveActivity> = new Map();

  constructor(eventBus: NeuralEventBus) {
    this.ledger = new EventLedger();
    this.eventBus = eventBus;
    this.wireEventBus();
  }

  private wireEventBus(): void {
    const sub = this.eventBus.subscribe(
      [...Object.keys(EVENT_TO_ACTIVITY)] as any,
      (event: NeuralEvent) => {
        const activityType = EVENT_TO_ACTIVITY[event.type];
        if (!activityType) return;

        const context: ActivityContext = {
          session_id: event.metadata?.session_id ?? 'default',
          agent_id: event.metadata?.agent_id ?? event.source,
          workspace_id: event.metadata?.workspace_id ?? 'default',
        };

        const activity = createActivity({
          type: activityType,
          inputs: event.payload as Record<string, unknown>,
          context,
          provenance: createProvenance('system_log', event.source),
          importance: event.metadata?.importance,
          tags: [event.type],
        });

        this.ledger.append(activity);
        this.activeActivities.set(activity.id, activity);
      },
    );

    this.unsubscribers.push(sub);
  }

  recordActivity(activity: CognitiveActivity): string {
    return this.ledger.append(activity);
  }

  completeActivity(activityId: string, result: unknown, status: 'success' | 'failure' | 'partial' | 'cancelled' = 'success', error?: string): void {
    const activity = this.ledger.getById(activityId);
    if (!activity) return;

    const completed = completeActivity(activity, {
      result,
      status,
      error,
    });
    this.ledger.update(activityId, completed);
    this.activeActivities.delete(activityId);

    this.eventBus.publish({
      type: 'cognitive:state_changed',
      source: 'recorder',
      payload: {
        activity_id: activityId,
        type: activity.type,
        status,
        duration_ms: completed.outcome.duration_ms,
      },
    });
  }

  getActiveActivities(): CognitiveActivity[] {
    return [...this.activeActivities.values()];
  }

  disconnect(): void {
    for (const sub of this.unsubscribers) {
      this.eventBus.unsubscribe(sub);
    }
    this.unsubscribers = [];
  }
}
