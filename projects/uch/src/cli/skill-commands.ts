/**
 * Skill commands: `skills` (catalog) and `skill` (scan / catalog / import /
 * provenance / create / optimize).
 */

import { SkillRegistry } from '../cognitive-memory/skill-registry.js';
import { SkillPackInstaller, SkillCreator, SkillOptimizer } from '../skills/index.js';
import type { CliContext } from './context.js';

export async function handleSkills(): Promise<void> {
  const { BUNDLED_SKILLS, renderSkillCatalog, loadSkillsDir } =
    await import('../agentic/skills/skills.js');
  const disk = await loadSkillsDir('.agents/skills');
  const local = await loadSkillsDir('./skills');
  const skills = [...disk, ...local, ...BUNDLED_SKILLS];
  console.log(renderSkillCatalog(skills));
  process.exit(0);
}

export async function handleSkill(ctx: CliContext): Promise<void> {
  const { args } = ctx;
  const sub = args[1] ?? '';
  if (sub === 'scan') {
    const dir = args[2];
    if (!dir) {
      console.error('Usage: uch skill scan <dir>');
      return;
    }
    const registry = new SkillRegistry();
    const installer = new SkillPackInstaller(registry);
    const result = await installer.installFromDir(dir, { sourcePrefix: 'external' });
    console.log(
      JSON.stringify(
        {
          installed: result.installed,
          skipped: result.skipped,
          totalRegistered: registry.count(),
        },
        null,
        2,
      ),
    );
  } else if (sub === 'catalog') {
    const dir = args[2];
    if (!dir) {
      console.error('Usage: uch skill catalog <dir>');
      return;
    }
    const { SkillCatalogScanner, renderSkillCatalogTable } =
      await import('../skills/skill-catalog.js');
    const scanner = new SkillCatalogScanner();
    const summary = await scanner.scanDir(dir);
    console.log(renderSkillCatalogTable(summary));
  } else if (sub === 'import') {
    const dir = args[2];
    const names = args.slice(3).filter((a) => a !== '--force');
    const force = args.includes('--force');
    if (!dir || names.length === 0) {
      console.error('Usage: uch skill import <dir> <name1> [name2...] [--force]');
      return;
    }
    const { SkillImporter } = await import('../skills/skill-catalog.js');
    const importer = new SkillImporter();
    const result = await importer.importFromDir(dir, './skills', names, { force });
    console.log(
      JSON.stringify(
        {
          installed: result.installed,
          skipped: result.skipped,
          failed: result.failed,
          totalBytes: result.totalBytes,
        },
        null,
        2,
      ),
    );
  } else if (sub === 'provenance') {
    const { loadImportIndex } = await import('../skills/skill-catalog.js');
    const index = await loadImportIndex('./skills');
    if (!index || Object.keys(index.skills).length === 0) {
      console.log('No imported skills recorded (index file not found).');
    } else {
      for (const [name, entry] of Object.entries(index.skills)) {
        console.log(
          `  ${name} <- ${entry.sourceRepo} (${entry.installedAt}, ${entry.files.length} files)`,
        );
      }
    }
  } else if (sub === 'create') {
    const name = args[2];
    const description = args.slice(3).join(' ');
    if (!name || !description) {
      console.error('Usage: uch skill create <name> "<description>"');
      return;
    }
    const creator = new SkillCreator();
    const result = await creator.writeToDir('./skills', { name, description });
    console.log(JSON.stringify({ created: result.filePath }, null, 2));
  } else if (sub === 'optimize') {
    const registry = new SkillRegistry();
    const optimizer = new SkillOptimizer();
    const reports = optimizer.analyzeAll(registry.getRecentInvocations(1000));
    console.log(JSON.stringify(reports, null, 2));
  } else {
    console.error(
      'Usage: uch skill scan <dir> | catalog <dir> | import <dir> <name...> | create <name> "<desc>" | optimize',
    );
  }
  process.exit(0);
}
