import type { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { ConceptStore } from './concept-store.js';
import { ExperienceStore } from './experience-store.js';
import { SkillStore } from './skill-store.js';
import { WorldModel } from './world-model.js';
import { ProjectStore } from './project-store.js';

export type FSEntryType = 'concept' | 'experience' | 'skill' | 'fact' | 'prediction' | 'project' | 'directory';

export interface FSEntry {
  name: string;
  type: FSEntryType;
  path: string;
  size?: number;
  lastModified: string;
}

export class NeuralFS {
  readonly concepts: ConceptStore;
  readonly experiences: ExperienceStore;
  readonly skills: SkillStore;
  readonly world: WorldModel;
  readonly projects: ProjectStore;

  constructor(private kernel: CognitiveKernel) {
    this.concepts = new ConceptStore(kernel);
    this.experiences = new ExperienceStore(kernel);
    this.skills = new SkillStore(kernel);
    this.world = new WorldModel(kernel);
    this.projects = new ProjectStore(kernel);
  }

  ls(path = '/'): FSEntry[] {
    const normalized = path.replace(/\\/g, '/').replace(/\/$/, '') || '';
    const now = new Date().toISOString();

    switch (normalized) {
      case '':
      case '/':
        return [
          { name: 'concepts', type: 'directory', path: '/concepts', lastModified: now },
          { name: 'experiences', type: 'directory', path: '/experiences', lastModified: now },
          { name: 'skills', type: 'directory', path: '/skills', lastModified: now },
          { name: 'world', type: 'directory', path: '/world', lastModified: now },
          { name: 'projects', type: 'directory', path: '/projects', lastModified: now },
        ];
      case '/concepts':
        return this.concepts.listAll().map((c) => ({
          name: c.name,
          type: 'concept' as FSEntryType,
          path: `/concepts/${c.id}`,
          lastModified: now,
        }));
      case '/experiences':
        return this.experiences.recent().map((e) => ({
          name: e.id.slice(0, 8),
          type: 'experience' as FSEntryType,
          path: `/experiences/${e.id}`,
          size: e.summary.length,
          lastModified: e.timestamp,
        }));
      case '/skills':
        return this.skills.listAll().map((s) => ({
          name: s.name,
          type: 'skill' as FSEntryType,
          path: `/skills/${s.id}`,
          lastModified: s.created_at,
        }));
      case '/world':
        return [
          { name: 'facts', type: 'directory', path: '/world/facts', lastModified: now },
          { name: 'predictions', type: 'directory', path: '/world/predictions', lastModified: now },
        ];
      case '/world/facts':
        return this.world.listFacts().map((f) => ({
          name: f.statement.slice(0, 40),
          type: 'fact' as FSEntryType,
          path: `/world/facts/${f.statement.slice(0, 20)}`,
          lastModified: now,
        }));
      case '/world/predictions':
        return this.world.listPredictions().map((p) => ({
          name: p.hypothesis.slice(0, 40),
          type: 'prediction' as FSEntryType,
          path: `/world/predictions/${p.hypothesis.slice(0, 20)}`,
          lastModified: now,
        }));
      case '/projects':
        return this.projects.listProjects().map((p) => ({
          name: p.name,
          type: 'project' as FSEntryType,
          path: `/projects/${p.projectId}`,
          lastModified: p.lastActivity,
        }));
      default:
        return [];
    }
  }

  async read(path: string): Promise<unknown | null> {
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length < 2) return this.ls(path.length === 0 ? '/' : path);

    const domain = parts[0];
    const id = parts[1];
    if (!domain) return null;
    switch (domain) {
      case 'concepts':
        return id ? this.concepts.read(id) : null;
      case 'experiences': {
        if (!id) return this.experiences.recent();
        const entries = this.experiences.recent().filter((e) => e.id.startsWith(id));
        return entries.length > 0 ? entries[0] : null;
      }
      case 'skills':
        return id ? this.skills.find(id) : null;
      default:
        return null;
    }
  }

  async write(path: string, data: unknown): Promise<boolean> {
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length < 1) return false;

    const [domain] = parts;
    switch (domain) {
      case 'concepts': {
        const d = data as { name: string; type: string; definition: string };
        await this.concepts.create(d.name, d.type as any, d.definition);
        return true;
      }
      case 'experiences': {
        const d = data as { content: string };
        await this.experiences.record({ type: 'text', text: d.content });
        return true;
      }
      case 'skills': {
        const d = data as { name: string; pattern: string; description: string };
        this.skills.learn(d.name, d.pattern, d.description);
        return true;
      }
      default:
        return false;
    }
  }

  async observe(path: string, callback: (event: { type: string; path: string }) => void): Promise<() => void> {
    const kernel = this.kernel;
    const interval = setInterval(() => {
      const entries = this.ls(path);
      callback({ type: 'read', path: path || '/' });
    }, 5000);
    return () => clearInterval(interval);
  }
}

export { ConceptStore } from './concept-store.js';
export { ExperienceStore } from './experience-store.js';
export { SkillStore } from './skill-store.js';
export { WorldModel } from './world-model.js';
export { ProjectStore } from './project-store.js';
