export type ConsciousnessLayer = 'reflex' | 'working' | 'strategic' | 'reflective' | 'meta';

export interface Thought {
  id: string;
  layer: ConsciousnessLayer;
  content: string;
  priority: number;
  timestamp: Date;
  source: string;
  acknowledged: boolean;
  tags: string[];
}

export interface ConsciousnessState {
  activeLayers: ConsciousnessLayer[];
  currentThought: Thought | null;
  recentInsights: Thought[];
  attentionFocus: string[];
  urgency: number;
  confidence: number;
  load: number;
  totalThoughts: number;
}

export class Consciousness {
  private thoughts: Thought[] = [];
  private maxThoughts: number;
  private state: ConsciousnessState;

  constructor(maxThoughts = 1000) {
    this.maxThoughts = maxThoughts;
    this.state = {
      activeLayers: ['reflex', 'working'],
      currentThought: null,
      recentInsights: [],
      attentionFocus: [],
      urgency: 0.5,
      confidence: 0.8,
      load: 0,
      totalThoughts: 0,
    };
  }

  observe(layer: ConsciousnessLayer, content: string, source: string, tags: string[] = []): Thought {
    const thought: Thought = {
      id: crypto.randomUUID(), layer, content,
      priority: layer === 'reflex' ? 1.0 : layer === 'working' ? 0.8 : layer === 'strategic' ? 0.6 : layer === 'reflective' ? 0.4 : 0.2,
      timestamp: new Date(), source, acknowledged: false, tags,
    };
    this.thoughts.push(thought);
    if (this.thoughts.length > this.maxThoughts) this.thoughts.shift();
    this.state.currentThought = thought;
    this.state.recentInsights = this.thoughts.slice(-20);
    this.updateState();
    return thought;
  }

  acknowledge(thoughtId: string): boolean {
    const t = this.thoughts.find((th) => th.id === thoughtId);
    if (!t) return false;
    t.acknowledged = true;
    return true;
  }

  focus(area: string): void {
    if (!this.state.attentionFocus.includes(area)) {
      this.state.attentionFocus.push(area);
    }
  }

  unfocus(area: string): void {
    this.state.attentionFocus = this.state.attentionFocus.filter((a) => a !== area);
  }

  activateLayer(layer: ConsciousnessLayer): void {
    if (!this.state.activeLayers.includes(layer)) {
      this.state.activeLayers.push(layer);
    }
  }

  deactivateLayer(layer: ConsciousnessLayer): void {
    this.state.activeLayers = this.state.activeLayers.filter((l) => l !== layer);
  }

  getUnacknowledged(): Thought[] {
    return this.thoughts.filter((t) => !t.acknowledged);
  }

  getByLayer(layer: ConsciousnessLayer): Thought[] {
    return this.thoughts.filter((t) => t.layer === layer);
  }

  getState(): ConsciousnessState {
    return { ...this.state };
  }

  private updateState(): void {
    const recent = this.thoughts.slice(-50);
    const unack = recent.filter((t) => !t.acknowledged);
    this.state.urgency = Math.min(1, unack.length / 10);
    this.state.load = Math.min(1, this.thoughts.length / this.maxThoughts);
    this.state.totalThoughts = this.thoughts.length;
  }

  getStats(): Record<string, unknown> {
    return {
      totalThoughts: this.thoughts.length,
      activeLayers: this.state.activeLayers,
      urgency: this.state.urgency,
      confidence: this.state.confidence,
      load: this.state.load,
      attentionFocus: this.state.attentionFocus,
      unacknowledged: this.getUnacknowledged().length,
      byLayer: Object.fromEntries(
        (['reflex', 'working', 'strategic', 'reflective', 'meta'] as ConsciousnessLayer[]).map(
          (l) => [l, this.thoughts.filter((t) => t.layer === l).length]
        )
      ),
    };
  }
}
