import { describe, it, expect } from 'vitest';
import {
  createPermissionRuleSet,
  addPermissionRule,
  ruleMatches,
  normalizePermissionPattern,
  isSafetySensitiveInput,
  hasPermissionsToUseTool,
  EMPTY_PERMISSION_RULE_SET,
} from '../permissions/permissions.js';
import { BashTool, FileReadTool, FileEditTool } from '../tools/implementations.js';
import type { ToolUseContext } from '../tools/types.js';

const ctx: ToolUseContext = {
  cwd: process.cwd(),
  abortController: new AbortController(),
  getSessionId: () => 'test',
};

describe('permission rules', () => {
  it('matches whole-tool patterns', () => {
    const rule = { bucket: 'deny' as const, pattern: 'Bash' };
    expect(ruleMatches(rule, 'Bash', { command: 'ls' })).toBe(true);
    expect(ruleMatches(rule, 'Read', {})).toBe(false);
  });

  it('matches content patterns', () => {
    const rule = { bucket: 'deny' as const, pattern: 'Bash(npm install:*)' };
    expect(ruleMatches(rule, 'Bash', { command: 'npm install lodash' })).toBe(true);
    expect(ruleMatches(rule, 'Bash', { command: 'npm run build' })).toBe(false);
  });

  it('matches wildcard content', () => {
    const rule = { bucket: 'allow' as const, pattern: 'Bash(git *)' };
    expect(ruleMatches(rule, 'Bash', { command: 'git status' })).toBe(true);
    expect(ruleMatches(rule, 'Bash', { command: 'rm -rf .' })).toBe(false);
  });

  it('matches field patterns', () => {
    const rule = { bucket: 'ask' as const, pattern: 'Read(~/.claude/*)' };
    expect(ruleMatches(rule, 'Read', { file_path: '~/.claude/settings.json' })).toBe(true);
    expect(ruleMatches(rule, 'Read', { file_path: '/src/main.ts' })).toBe(false);
  });

  it('normalizes bare patterns into tool patterns', () => {
    expect(normalizePermissionPattern('Bash', 'npm install:*')).toBe('Bash(npm install:*)');
    expect(normalizePermissionPattern('Bash', 'Bash(ls)')).toBe('Bash(ls)');
  });
});

describe('permission rule sets', () => {
  it('buckets rules', () => {
    const set = createPermissionRuleSet([
      { bucket: 'allow', pattern: 'Read' },
      { bucket: 'deny', pattern: 'Bash' },
      { bucket: 'ask', pattern: 'Write' },
    ]);
    expect(set.alwaysAllow.length).toBe(1);
    expect(set.alwaysDeny.length).toBe(1);
    expect(set.alwaysAsk.length).toBe(1);
  });

  it('adds rules immutably', () => {
    const base = createPermissionRuleSet();
    const next = addPermissionRule(base, { bucket: 'deny', pattern: 'Grep' });
    expect(base.alwaysDeny.length).toBe(0);
    expect(next.alwaysDeny.length).toBe(1);
  });
});

describe('safety sensitivity', () => {
  it('flags sensitive paths regardless of bypass', () => {
    expect(isSafetySensitiveInput({ file_path: '/repo/.git/config' })).toBe(true);
    expect(isSafetySensitiveInput({ file_path: '/repo/.env' })).toBe(true);
    expect(isSafetySensitiveInput({ file_path: '/repo/.claude/settings.json' })).toBe(true);
    expect(isSafetySensitiveInput({ command: 'ls' })).toBe(false);
  });
});

describe('permission pipeline', () => {
  it('denies on deny rules before allow rules', async () => {
    const decision = await hasPermissionsToUseTool(BashTool, { command: 'rm -rf /' }, ctx, {
      mode: 'default',
      rules: createPermissionRuleSet([
        { bucket: 'allow', pattern: 'Bash' },
        { bucket: 'deny', pattern: 'Bash(rm:*)' },
      ]),
    });
    expect(decision.behavior).toBe('deny');
  });

  it('allows read-only tools without prompting', async () => {
    const decision = await hasPermissionsToUseTool(FileReadTool, { file_path: 'x.ts' }, ctx, {
      mode: 'default',
      rules: EMPTY_PERMISSION_RULE_SET,
    });
    expect(decision.behavior).toBe('allow');
  });

  it('asks for writes in default mode', async () => {
    const decision = await hasPermissionsToUseTool(FileEditTool, { file_path: 'x.ts' }, ctx, {
      mode: 'default',
      rules: EMPTY_PERMISSION_RULE_SET,
    });
    expect(decision.behavior).toBe('ask');
  });

  it('accepts edits in acceptEdits mode', async () => {
    const decision = await hasPermissionsToUseTool(FileEditTool, { file_path: 'x.ts' }, ctx, {
      mode: 'acceptEdits',
      rules: EMPTY_PERMISSION_RULE_SET,
    });
    expect(decision.behavior).toBe('allow');
  });

  it('blocks writes in plan mode', async () => {
    const decision = await hasPermissionsToUseTool(FileEditTool, { file_path: 'x.ts' }, ctx, {
      mode: 'plan',
      rules: EMPTY_PERMISSION_RULE_SET,
    });
    expect(decision.behavior).toBe('deny');
  });

  it('denies headless asks', async () => {
    const decision = await hasPermissionsToUseTool(BashTool, { command: 'npm install' }, ctx, {
      mode: 'default',
      rules: EMPTY_PERMISSION_RULE_SET,
      headless: true,
    });
    expect(decision.behavior).toBe('deny');
  });

  it('respects alwaysAsk rules', async () => {
    const decision = await hasPermissionsToUseTool(BashTool, { command: 'git push' }, ctx, {
      mode: 'default',
      rules: createPermissionRuleSet([{ bucket: 'ask', pattern: 'Bash(git push)' }]),
    });
    expect(decision.behavior).toBe('ask');
  });

  it('bypass mode skips rules but not safety-sensitive paths', async () => {
    const safe = await hasPermissionsToUseTool(FileEditTool, { file_path: 'x.ts' }, ctx, {
      mode: 'bypassPermissions',
      rules: EMPTY_PERMISSION_RULE_SET,
    });
    expect(safe.behavior).toBe('allow');

    const sensitive = await hasPermissionsToUseTool(FileEditTool, { file_path: '/repo/.env' }, ctx, {
      mode: 'bypassPermissions',
      rules: EMPTY_PERMISSION_RULE_SET,
    });
    expect(sensitive.behavior).toBe('deny');
  });

  it('allow rules do not override safety-sensitive writes', async () => {
    const decision = await hasPermissionsToUseTool(FileEditTool, { file_path: '/repo/.git/config' }, ctx, {
      mode: 'default',
      rules: createPermissionRuleSet([{ bucket: 'allow', pattern: 'Edit' }]),
    });
    expect(decision.behavior).toBe('deny');
  });

  it('denies in dontAsk mode for writes', async () => {
    const decision = await hasPermissionsToUseTool(FileEditTool, { file_path: 'x.ts' }, ctx, {
      mode: 'dontAsk',
      rules: EMPTY_PERMISSION_RULE_SET,
    });
    expect(decision.behavior).toBe('deny');
  });
});
