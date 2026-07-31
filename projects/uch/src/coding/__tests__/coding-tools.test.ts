import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { CodeIndex } from '../code-index.js';
import { FileEditor } from '../file-editor.js';
import { CommandRunner } from '../command-runner.js';
import { DiffReview } from '../diff-review.js';
import { CodingSkills } from '../coding-skills.js';
import { CodingToolkit } from '../toolkit.js';

describe('CodeIndex — symbol extraction', () => {
  let index: CodeIndex;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(tmpdir(), 'uch-index-'));
    index = new CodeIndex();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('extracts functions, classes, interfaces, types, and consts from TypeScript', async () => {
    const file = path.join(tmpDir, 'a.ts');
    const source = [
      'import { foo } from "./b";',
      'export function bar(x: number): number {',
      '  return x + 1;',
      '}',
      'export class Widget {',
      '  render() { return 1; }',
      '}',
      'export interface Config {',
      '  name: string;',
      '}',
      'export type Alias = string;',
      'export const helper = (a: number) => a * 2;',
    ].join('\n');
    fs.writeFileSync(file, source);

    await index.indexFile(file);

    const symbols = index.getSymbols(file);
    const names = symbols.map((s) => s.name);
    expect(names).toContain('bar');
    expect(names).toContain('Widget');
    expect(names).toContain('Config');
    expect(names).toContain('Alias');
    expect(names).toContain('helper');
    expect(names).toContain('foo');

    const bar = symbols.find((s) => s.name === 'bar')!;
    expect(bar.kind).toBe('function');
    expect(bar.exported).toBe(true);
    expect(bar.endLine).toBeGreaterThanOrEqual(bar.line);

    const helper = symbols.find((s) => s.name === 'helper')!;
    expect(helper.kind).toBe('const');
  });

  it('extracts functions and classes from Python', async () => {
    const file = path.join(tmpDir, 'mod.py');
    fs.writeFileSync(file, [
      'from os import path',
      'def greet(name: str) -> str:',
      '    return f"hi {name}"',
      'class Service:',
      '    pass',
    ].join('\n'));

    await index.indexFile(file);

    const names = index.getSymbols(file).map((s) => s.name);
    expect(names).toContain('greet');
    expect(names).toContain('Service');
    expect(index.getImports(file)[0]!.specifier).toBe('os');
  });

  it('handles unsupported files gracefully', async () => {
    const file = path.join(tmpDir, 'data.json');
    fs.writeFileSync(file, '{}');
    expect(index.isSupported(file)).toBe(false);
    expect(index.languageOf(file)).toBe('unknown');
    await expect(index.indexFile(file)).resolves.toBeDefined();
  });
});

describe('CodeIndex — import graph and impact analysis', () => {
  let index: CodeIndex;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(tmpdir(), 'uch-graph-'));
    index = new CodeIndex();
    fs.writeFileSync(path.join(tmpDir, 'entry.ts'), 'import { helper } from "./helper";\nimport { util } from "./util";\n');
    fs.writeFileSync(path.join(tmpDir, 'helper.ts'), 'export const helper = () => 1;\n');
    fs.writeFileSync(path.join(tmpDir, 'util.ts'), 'import { helper } from "./helper";\nexport const util = () => 2;\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('builds dependency and reverse-dependency maps', async () => {
    await index.indexDirectory(tmpDir);

    const entry = path.join(tmpDir, 'entry.ts');
    const helper = path.join(tmpDir, 'helper.ts');
    const util = path.join(tmpDir, 'util.ts');

    expect(index.getDependencies(entry)).toContain(helper);
    expect(index.getDependencies(entry)).toContain(util);
    expect(index.getDependents(helper)).toContain(entry);
    expect(index.getDependents(helper)).toContain(util);
  });

  it('computes transitive dependents in impact analysis', async () => {
    await index.indexDirectory(tmpDir);
    const report = index.impactAnalysis(path.join(tmpDir, 'helper.ts'));

    expect(report.directDependents).toContain(path.join(tmpDir, 'entry.ts'));
    expect(report.directDependents).toContain(path.join(tmpDir, 'util.ts'));
    expect(report.transitiveDependents.length).toBeGreaterThanOrEqual(0);
    expect(report.totalFiles).toBeGreaterThanOrEqual(3);
  });

  it('enumerates the import graph with edge kinds', async () => {
    await index.indexDirectory(tmpDir);
    const edges = index.getImportGraph();
    const helper = path.join(tmpDir, 'helper.ts');

    const helperEdges = edges.filter((e) => e.to === helper);
    expect(helperEdges.length).toBe(2);
    for (const edge of helperEdges) {
      expect(edge.kind).toBe('relative');
      expect(edge.specifier).toBe('./helper');
    }
  });

  it('finds usages of a symbol across indexed files', async () => {
    await index.indexDirectory(tmpDir);
    const usages = index.findUsages('helper');
    expect(usages.length).toBeGreaterThanOrEqual(2);
  });

  it('reports stats and supports clear', async () => {
    await index.indexDirectory(tmpDir);
    const stats = index.getStats();
    expect(stats.files).toBe(3);
    expect(stats.symbols).toBeGreaterThan(0);
    expect(stats.imports).toBeGreaterThanOrEqual(3);

    index.clear();
    expect(index.getStats().files).toBe(0);
  });
});

describe('FileEditor — safe read/write/edit with undo', () => {
  let editor: FileEditor;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(tmpdir(), 'uch-editor-'));
    editor = new FileEditor({ root: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('blocks paths outside the workspace root by default', () => {
    expect(() => editor.write('../outside.ts', 'x')).toThrow(/escapes workspace root/);
    expect(() => editor.read('C:/windows/system32/drivers/etc/hosts')).toThrow(/escapes workspace root/);
  });

  it('writes new files and creates parent directories', () => {
    const result = editor.write('src/a.ts', 'export const a = 1;\n');
    expect(result.applied).toBe(true);
    expect(result.message).toContain('Created');
    expect(fs.existsSync(path.join(tmpDir, 'src/a.ts'))).toBe(true);
  });

  it('reads with line ranges', () => {
    editor.write('a.ts', 'line1\nline2\nline3\nline4\n');
    const full = editor.read('a.ts');
    expect(full.totalLines).toBe(4);
    const partial = editor.read('a.ts', { startLine: 2, endLine: 3 });
    expect(partial.content).toBe('line2\nline3');
  });

  it('edits a line range in place', () => {
    editor.write('a.ts', 'one\ntwo\nthree\n');
    const result = editor.edit('a.ts', 2, 2, 'TWO');
    expect(result.applied).toBe(true);
    expect(fs.readFileSync(path.join(tmpDir, 'a.ts'), 'utf-8')).toBe('one\nTWO\nthree\n');
  });

  it('inserts and appends content', () => {
    editor.write('a.ts', 'a\nc\n');
    editor.insert('a.ts', 1, 'b');
    expect(fs.readFileSync(path.join(tmpDir, 'a.ts'), 'utf-8')).toBe('a\nb\nc\n');
    editor.append('a.ts', 'd');
    expect(fs.readFileSync(path.join(tmpDir, 'a.ts'), 'utf-8')).toBe('a\nb\nc\nd\n');
  });

  it('undoes edits back to the original state', () => {
    editor.write('a.ts', 'original\n');
    editor.edit('a.ts', 1, 1, 'changed');
    expect(fs.readFileSync(path.join(tmpDir, 'a.ts'), 'utf-8')).toBe('changed\n');

    const undo = editor.undo('a.ts');
    expect(undo.applied).toBe(true);
    expect(undo.undoAvailable).toBe(true);
    expect(fs.readFileSync(path.join(tmpDir, 'a.ts'), 'utf-8')).toBe('original\n');

    const undo2 = editor.undo('a.ts');
    expect(undo2.applied).toBe(true);
    expect(undo2.undoAvailable).toBe(false);

    const undo3 = editor.undo('a.ts');
    expect(undo3.applied).toBe(false);
    expect(undo3.message).toBe('No undo history');
  });

  it('rejects invalid edit ranges', () => {
    editor.write('a.ts', 'only\n');
    expect(() => editor.edit('a.ts', 0, 1, 'x')).toThrow(/Invalid line range/);
    expect(() => editor.edit('a.ts', 1, 5, 'x')).toThrow(/Invalid line range/);
    expect(() => editor.read('missing.ts')).toThrow(/File not found/);
  });

  it('lists directory entries and deletes files', () => {
    editor.write('a.ts', 'x\n');
    editor.write('sub/b.ts', 'y\n');
    const entries = editor.list('.');
    expect(entries.some((e) => e.name === 'a.ts')).toBe(true);
    expect(entries.some((e) => e.name === 'sub' && e.isDirectory)).toBe(true);

    expect(editor.delete('a.ts')).toBe(true);
    expect(editor.exists('a.ts')).toBe(false);
    expect(editor.delete('a.ts')).toBe(false);
  });
});

describe('CommandRunner — safe exec with timeout/allowlist', () => {
  it('blocks denylisted commands', async () => {
    const runner = new CommandRunner();
    const result = await runner.run('rm -rf /');
    expect(result.exitCode).toBeNull();
    expect(result.stderr).toContain('denylist');
  });

  it('enforces allowlist prefixes', async () => {
    const runner = new CommandRunner({ allowlist: ['git', 'npm test'] });
    expect(runner.isCommandAllowed('git status').allowed).toBe(true);
    expect(runner.isCommandAllowed('npm test --run').allowed).toBe(true);
    const blocked = runner.isCommandAllowed('del file.txt');
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('allowlist');
  });

  it('runs commands and captures output', async () => {
    const runner = new CommandRunner({ allowlist: ['node'] });
    const result = await runner.run('node -e "process.stdout.write(\'hello-out\'); process.stderr.write(\'hello-err\')"');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello-out');
    expect(result.stderr).toContain('hello-err');
    expect(result.timedOut).toBe(false);
  });

  it('times out long-running commands', async () => {
    const runner = new CommandRunner({ defaultTimeoutMs: 200 });
    const result = await runner.run('node -e "setTimeout(() => {}, 5000)"', { timeoutMs: 200 });
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBeNull();
    expect(result.stderr).toContain('timed out');
  }, 10000);

  it('reports non-zero exit codes and test() helper', async () => {
    const runner = new CommandRunner({ allowlist: ['node'] });
    const fail = await runner.run('node -e "process.exit(3)"');
    expect(fail.exitCode).toBe(3);

    const ok = await runner.test('node -e "process.exit(0)"');
    expect(ok).toBe(true);
    const bad = await runner.test('node -e "process.exit(1)"');
    expect(bad).toBe(false);
  });
});

describe('DiffReview — unified diff parsing + findings', () => {
  const diff = [
    'diff --git a/src/app.ts b/src/app.ts',
    'index abc..def 100644',
    '--- a/src/app.ts',
    '+++ b/src/app.ts',
    '@@ -1,5 +1,9 @@',
    ' import { x } from "./x";',
    ' export function run() {',
    '-  console.log("old");',
    '+  console.log("debug here");',
    '+  // TODO: revisit this',
    '+  const apiKey = "sk-abcdefghijklmnopqrstuvwxyz123456";',
    '+  const done = true;',
    '+  const done = true;',
    '+  const done = true;',
    '+  const done = true;',
    ' }',
    '',
  ].join('\n');

  it('parses hunks, additions, and deletions', () => {
    const review = new DiffReview();
    const summary = review.parseUnifiedDiff(diff);
    expect(summary.changedFiles).toBe(1);
    expect(summary.totalAdditions).toBe(7);
    expect(summary.totalDeletions).toBe(1);
    const file = summary.files[0]!;
    expect(file.status).toBe('modified');
    expect(file.hunks.length).toBe(1);
    expect(file.hunks[0]!.oldStart).toBe(1);
  });

  it('flags TODOs, console logs, and secrets', () => {
    const review = new DiffReview();
    const result = review.review(diff);
    const categories = result.findings.map((f) => f.category);
    expect(categories).toContain('tech-debt');
    expect(categories).toContain('debugging');
    expect(categories).toContain('security');
    const secret = result.findings.find((f) => f.category === 'security')!;
    expect(secret.severity).toBe('error');
  });

  it('detects duplicate code blocks', () => {
    const dupDiff = [
      'diff --git a/x.ts b/x.ts',
      '--- a/x.ts',
      '+++ b/x.ts',
      '@@ -1,2 +1,12 @@',
      '+export const a = () => {',
      '+  const x = 1;',
      '+  const y = 2;',
      '+  const z = 3;',
      '+  return x + y + z;',
      '+};',
      '+export const b = () => {',
      '+  const x = 1;',
      '+  const y = 2;',
      '+  const z = 3;',
      '+  return x + y + z;',
      '+};',
      '',
    ].join('\n');
    const review = new DiffReview();
    const result = review.review(dupDiff);
    expect(result.findings.some((f) => f.category === 'duplication')).toBe(true);
  });

  it('detects added/deleted files and respects disabled checks', () => {
    const addDiff = [
      'diff --git a/new.ts b/new.ts',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/new.ts',
      '@@ -0,0 +1,2 @@',
      '+console.log("x");',
      '+// TODO: later',
      '',
    ].join('\n');
    const review = new DiffReview();
    const summary = review.parseUnifiedDiff(addDiff);
    expect(summary.files[0]!.status).toBe('added');

    const result = review.review(addDiff, { checkConsoleLog: false, checkTodoFixme: false });
    expect(result.findings.length).toBe(0);
  });

  it('summarizes findings textually', () => {
    const review = new DiffReview();
    const result = review.review(diff);
    const summary = review.summarize(result);
    expect(summary).toContain('Changed files: 1');
    expect(summary).toContain('Additions: 7, Deletions: 1');
    expect(summary).toContain('Findings:');
  });
});

describe('CodingSkills — catalog + matcher', () => {
  let skills: CodingSkills;

  beforeEach(() => {
    skills = new CodingSkills();
  });

  it('exposes a populated catalog with categories', () => {
    expect(skills.count).toBeGreaterThanOrEqual(10);
    const all = skills.getAll();
    expect(all.every((s) => s.id.startsWith('skill:'))).toBe(true);
    const categories = new Set(all.map((s) => s.category));
    expect(categories.has('debugging')).toBe(true);
    expect(categories.has('code-review')).toBe(true);
    expect(categories.has('testing')).toBe(true);
  });

  it('matches tasks to skills by triggers', () => {
    const match = skills.suggest('write unit tests with good coverage');
    expect(match.skill.category).toBe('testing');
    expect(match.matchedTriggers.length).toBeGreaterThan(0);
    expect(match.score).toBeGreaterThan(0);
  });

  it('falls back to general skill when nothing matches', () => {
    const match = skills.suggest('zzz qqq vvv');
    expect(match.skill.id).toBe('skill:general');
    expect(match.matchedTriggers).toEqual([]);
  });

  it('ranks suggestions and filters by category', () => {
    const matches = skills.suggestAll('review my pull request and check for security issues', 3);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.score).toBeGreaterThanOrEqual(matches[matches.length - 1]!.score);

    const reviews = skills.getByCategory('code-review');
    expect(reviews.length).toBeGreaterThanOrEqual(1);
  });

  it('renders a skill as markdown', () => {
    const skill = skills.get('skill:debug')!;
    const rendered = skills.render(skill);
    expect(rendered).toContain('## Debugging');
    expect(rendered).toContain('### Steps');
    expect(rendered).toContain('### Outputs');
    expect(rendered).toContain('### Do not use when');
  });
});

describe('CodingToolkit — facade', () => {
  let toolkit: CodingToolkit;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(tmpdir(), 'uch-toolkit-'));
    fs.writeFileSync(path.join(tmpDir, 'a.ts'), 'import { b } from "./b";\nexport const a = () => b();\n');
    fs.writeFileSync(path.join(tmpDir, 'b.ts'), 'export const b = () => 1;\n');
    toolkit = new CodingToolkit({ workspaceRoot: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('analyzes a project directory', async () => {
    const result = await toolkit.analyzeProject(tmpDir);
    expect(result.files).toBe(2);
    expect(result.stats.files).toBe(2);
    expect(result.stats.symbols).toBeGreaterThanOrEqual(3);
  });

  it('returns context for a file — symbols, imports, dependents', async () => {
    await toolkit.analyzeProject(tmpDir);
    const ctx = toolkit.getContextForFile(path.join(tmpDir, 'b.ts'));
    expect(ctx.symbols.length).toBeGreaterThan(0);
    expect(ctx.dependents).toContain(path.join(tmpDir, 'a.ts'));
    expect(ctx.dependencies.length).toBe(0);
  });

  it('suggests skills and reports stats', async () => {
    const match = toolkit.suggestSkill('review this pull request');
    expect(match.skill.category).toBe('code-review');

    await toolkit.analyzeProject(tmpDir);
    const stats = toolkit.getStats();
    expect(stats.index.files).toBe(2);
    expect(stats.skills).toBeGreaterThanOrEqual(10);
    expect(typeof stats.undoHistory).toBe('number');
  });
});
