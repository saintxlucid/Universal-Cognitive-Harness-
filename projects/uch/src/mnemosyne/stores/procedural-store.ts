// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — Procedural cortex: patterns, skills, lessons
// Verified patterns (tool sequences, solution templates) shaped by outcome
// rewards (DA-modulated). Lessons: mistake → root cause → prevention, always
// linked to the episodes that produced them.
// ═══════════════════════════════════════════════════════════════════════════

import type { Lesson, PatternSkill, Scope } from '../types.js';
import { reviveDates, reviveDateList } from '../hydrate.js';

export interface PatternInput {
  id: string;
  pattern: string;
  condition: string;
  class: 'pattern' | 'skill' | 'lesson';
  scope: Scope;
  sourceEpisodes: string[];
}

export class ProceduralStore {
  private items = new Map<string, PatternSkill>();
  private lessons = new Map<string, Lesson>();

  addPattern(input: PatternInput): PatternSkill {
    const item: PatternSkill = {
      ...input,
      utilities: [],
      accessTimes: [],
      lastAccess: null,
      lti: 0.4,
    };
    this.items.set(item.id, item);
    return item;
  }

  addLesson(input: PatternInput & { mistakeRef: string; rootCause: string; prevention: string }): Lesson {
    const lesson: Lesson = {
      ...input,
      utilities: [],
      accessTimes: [],
      lastAccess: null,
      lti: 0.7,
      mistakeRef: input.mistakeRef,
      rootCause: input.rootCause,
      prevention: input.prevention,
    };
    this.lessons.set(lesson.id, lesson);
    return lesson;
  }

  get(id: string): PatternSkill | Lesson | undefined {
    const item = this.items.get(id) ?? this.lessons.get(id);
    if (item) {
      item.accessTimes.push(new Date());
      item.lastAccess = new Date();
    }
    return item;
  }

  all(): Array<PatternSkill | Lesson> {
    return [...this.items.values(), ...this.lessons.values()];
  }

  lessonsAll(): Lesson[] {
    return [...this.lessons.values()];
  }

  byScope(scope: Scope): Array<PatternSkill | Lesson> {
    const project = `${scope.user}::${scope.agent}::${scope.project}`;
    return this.all().filter((p) => p.scope.project === scope.project && `${p.scope.user}::${p.scope.agent}::${p.scope.project}` === project);
  }

  reinforce(id: string, outcome: string, reward: number): void {
    const item = this.items.get(id) ?? this.lessons.get(id);
    if (!item) return;
    const existing = item.utilities.find((u) => u.outcome === outcome);
    if (existing) {
      existing.reward = existing.reward * 0.8 + reward * 0.2;
    } else {
      item.utilities.push({ outcome, reward });
    }
    item.lti = Math.min(1, item.lti + Math.max(0, reward) * 0.1);
  }

  demote(id: string): void {
    const item = this.items.get(id) ?? this.lessons.get(id);
    if (item) item.lti = Math.max(0, item.lti - 0.2);
  }

  prune(minLti: number): string[] {
    const removed: string[] = [];
    for (const [id, item] of this.items) {
      if (item.lti < minLti && item.utilities.every((u) => u.reward <= 0)) {
        this.items.delete(id);
        removed.push(id);
      }
    }
    return removed;
  }

  count(): { patterns: number; lessons: number } {
    return { patterns: this.items.size, lessons: this.lessons.size };
  }

  snapshot(): { items: PatternSkill[]; lessons: Lesson[] } {
    return {
      items: [...this.items.values()].map((i) => structuredClone(i)),
      lessons: [...this.lessons.values()].map((l) => structuredClone(l)),
    };
  }

  restore(data: { items: PatternSkill[]; lessons: Lesson[] }): void {
    this.items.clear();
    this.lessons.clear();
    for (const raw of data.items) {
      const item: PatternSkill = { ...raw };
      reviveDates(item, ['lastAccess']);
      item.accessTimes = reviveDateList(item.accessTimes);
      this.items.set(item.id, item);
    }
    for (const raw of data.lessons) {
      const lesson: Lesson = { ...raw };
      reviveDates(lesson, ['lastAccess']);
      lesson.accessTimes = reviveDateList(lesson.accessTimes);
      this.lessons.set(lesson.id, lesson);
    }
  }
}
