import { EventLedger } from '../cognitive-recorder/event-ledger.js';
import type { CognitiveActivity } from '../cognitive-recorder/cognitive-activity.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import type { EpisodeContent } from '../kernel/types/episode.js';

export interface PipelineReport {
  activities_processed: number;
  episodes_created: number;
  concepts_extracted: number;
  duration_ms: number;
}

export class MemoryPipeline {
  private ledger: EventLedger;
  private kernel: CognitiveKernel;

  constructor(ledger: EventLedger, kernel: CognitiveKernel) {
    this.ledger = ledger;
    this.kernel = kernel;
  }

  processActivity(activityId: string): boolean {
    const activity = this.ledger.getById(activityId);
    if (!activity) return false;

    this.activityToEpisode(activity);
    this.extractConcepts(activity);
    return true;
  }

  processSince(date: Date): PipelineReport {
    const start = Date.now();
    const activities = this.ledger.getByTimeRange(date, new Date());
    let episodesCreated = 0;
    let conceptsExtracted = 0;

    for (const activity of activities) {
      if (this.activityToEpisode(activity)) episodesCreated++;
      if (this.extractConcepts(activity)) conceptsExtracted++;
    }

    return {
      activities_processed: activities.length,
      episodes_created: episodesCreated,
      concepts_extracted: conceptsExtracted,
      duration_ms: Date.now() - start,
    };
  }

  private activityToEpisode(activity: CognitiveActivity): boolean {
    const content = this.buildEpisodeContent(activity);
    if (!content) return false;

    this.kernel.remember({
      content,
      concepts: activity.evidence.map((e) => e.source_id).filter(Boolean),
      provenance: activity.provenance,
    });

    return true;
  }

  private buildEpisodeContent(activity: CognitiveActivity): EpisodeContent | null {
    switch (activity.type) {
      case 'observe':
      case 'converse':
        return {
          type: 'text',
          text: activity.goal ?? `${activity.type} activity`,
        };
      case 'execute':
        return {
          type: 'tool_call',
          tool: activity.tools[0]?.tool_name ?? 'unknown',
          input: activity.tools[0]?.input,
          output: activity.tools[0]?.output,
        };
      case 'test':
      case 'build':
      case 'commit':
        return {
          type: 'observation',
          observation: `[${activity.type}] ${activity.outcome.summary}`,
        };
      default:
        return {
          type: 'observation',
          observation: `${activity.type}: ${activity.outcome.summary}`,
        };
    }
  }

  private extractConcepts(activity: CognitiveActivity): boolean {
    if (!activity.goal) return false;

    const words = activity.goal
      .toLowerCase()
      .replace(/[^a-z0-9\s_]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['this', 'that', 'with', 'from', 'have', 'been', 'were'].includes(w))
      .slice(0, 5);

    for (const word of words) {
      if (!this.kernel.findConcept(word)) {
        this.kernel.addConcept({
          name: word,
          concept_type: 'entity',
          definition: `Extracted from ${activity.type} activity: ${activity.goal}`,
        });
      }
    }

    return words.length > 0;
  }
}
