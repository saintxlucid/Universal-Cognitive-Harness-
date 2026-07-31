import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface SkillSection {
  title: string;
  content: string;
}

export interface CreateSkillSpec {
  name: string;
  description: string;
  version?: string;
  author?: string;
  license?: string;
  tags?: string[];
  relatedSkills?: string[];
  sections?: SkillSection[];
}

export interface CreateSkillResult {
  name: string;
  filePath: string;
  content: string;
}

function escapeFrontmatter(value: string): string {
  return value.replace(/\n/g, ' ').replace(/"/g, '\\"');
}

function renderFrontmatter(spec: CreateSkillSpec): string {
  const lines = ['---', `name: ${spec.name}`, `description: "${escapeFrontmatter(spec.description)}"`];
  if (spec.version) lines.push(`version: ${spec.version}`);
  if (spec.author) lines.push(`author: ${spec.author}`);
  if (spec.license) lines.push(`license: ${spec.license}`);
  if (spec.tags && spec.tags.length > 0) {
    lines.push('metadata:');
    lines.push(`  tags: [${spec.tags.join(', ')}]`);
  }
  if (spec.relatedSkills && spec.relatedSkills.length > 0) {
    lines.push(`  related_skills: [${spec.relatedSkills.join(', ')}]`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

const DEFAULT_SECTIONS: SkillSection[] = [
  { title: 'Overview', content: 'Brief description of what this skill does and when to use it.' },
  { title: 'When to Use', content: 'List the trigger conditions and use cases for this skill.' },
  { title: 'Workflow', content: 'Step-by-step instructions for applying this skill.' },
  { title: 'Checklist', content: '- [ ] Verify each step completes before proceeding.' },
];

export class SkillCreator {
  build(spec: CreateSkillSpec): string {
    const frontmatter = renderFrontmatter(spec);
    const sections = spec.sections && spec.sections.length > 0 ? spec.sections : DEFAULT_SECTIONS;
    const body = sections
      .map((s) => `## ${s.title}\n\n${s.content.trim()}`)
      .join('\n\n');
    return `${frontmatter}${body}\n`;
  }

  async writeToDir(dir: string, spec: CreateSkillSpec): Promise<CreateSkillResult> {
    const content = this.build(spec);
    const skillDir = path.join(dir, spec.name);
    await fs.mkdir(skillDir, { recursive: true });
    const filePath = path.join(skillDir, 'SKILL.md');
    await fs.writeFile(filePath, content, 'utf8');
    return { name: spec.name, filePath, content };
  }
}
