import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('workspace contains root configs', () => {
  const required = [
    'eslint.config.mjs',
    '.gitignore',
    '.gitattributes',
    '.editorconfig',
    '.nvmrc',
    '.prettierrc',
    '.prettierignore',
    'LICENSE',
    'SECURITY.md',
    'CODE_OF_CONDUCT.md',
    'CONTRIBUTING.md',
    'Dockerfile',
    '.dockerignore',
    '.markdownlint.json',
  ];

  for (const file of required) {
    const fp = path.join(root, file);
    assert.ok(fs.existsSync(fp), `Missing required file: ${file}`);
  }
});

test('workspace contains CI workflow and Dependabot config', () => {
  const required = [
    '.github/workflows/ci.yml',
    '.github/dependabot.yml',
  ];

  for (const file of required) {
    const fp = path.join(root, file);
    assert.ok(fs.existsSync(fp), `Missing required file: ${file}`);
  }
});

test('workspace has advanced CI workflows', () => {
  const required = [
    '.github/workflows/release.yml',
    '.github/workflows/stale.yml',
    '.github/workflows/codeql.yml',
    '.github/workflows/labeler.yml',
  ];

  for (const file of required) {
    const fp = path.join(root, file);
    assert.ok(fs.existsSync(fp), `Missing CI workflow: ${file}`);
  }
});

test('workspace has GitHub templates and CODEOWNERS', () => {
  const required = [
    '.github/ISSUE_TEMPLATE/bug.yml',
    '.github/ISSUE_TEMPLATE/feature.yml',
    '.github/ISSUE_TEMPLATE/config.yml',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/CODEOWNERS',
    '.github/labeler.yml',
  ];

  for (const file of required) {
    const fp = path.join(root, file);
    assert.ok(fs.existsSync(fp), `Missing GitHub file: ${file}`);
  }
});

test('workspace has essential .vscode configs', () => {
  const required = [
    '.vscode/extensions.json',
    '.vscode/launch.json',
    '.vscode/settings.json',
    '.vscode/mcp.json',
  ];

  for (const file of required) {
    const fp = path.join(root, file);
    assert.ok(fs.existsSync(fp), `Missing required file: ${file}`);
  }
});

test('workspace has pre-commit hooks via husky', () => {
  const huskyFile = path.join(root, '.husky', 'pre-commit');
  assert.ok(fs.existsSync(huskyFile), 'Missing .husky/pre-commit hook');
});

test('workspace has devcontainer config', () => {
  const dcPath = path.join(root, '.devcontainer', 'devcontainer.json');
  assert.ok(fs.existsSync(dcPath), 'Missing .devcontainer/devcontainer.json');
});

test('package.json has required scripts and lint-staged config', () => {
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  const requiredScripts = ['dev', 'build', 'lint', 'typecheck', 'format', 'format:check', 'test', 'test:all', 'doctor', 'prepare'];
  for (const script of requiredScripts) {
    assert.ok(pkg.scripts?.[script], `Missing script: ${script}`);
  }

  assert.ok(pkg['lint-staged'], 'Missing lint-staged config');
  assert.ok(pkg.devDependencies?.husky, 'Missing husky devDependency');
  assert.ok(pkg.devDependencies?.['lint-staged'], 'Missing lint-staged devDependency');
});

test('workspace has root .env.example with Docker service vars', () => {
  const envPath = path.join(root, '.env.example');
  assert.ok(fs.existsSync(envPath), 'Missing root .env.example');
  const content = fs.readFileSync(envPath, 'utf-8');
  assert.ok(content.includes('POSTGRES_USER'), '.env.example missing POSTGRES_USER');
  assert.ok(content.includes('REDIS_PORT'), '.env.example missing REDIS_PORT');
});

test('workspace has .opencode skill definitions', () => {
  const skills = [
    'code-review',
    'arch-design',
    'ai-development',
    'deployment',
    'performance',
    'database',
    'security',
    'testing',
    'docs-writing',
    'ui-design',
    'api-design',
    'devops',
    'accessibility',
    'data-science',
    'workspace-operations',
    'project-readiness',
    'research-with-evidence',
    'session-handoff',
    'mcp-integration',
    'delivery-validation',
    'source-skill-discovery',
    'organic-code',
    'codebase-archaeology',
    'engineering-constitution',
    'ai-code-pitfalls',
    'organic-review',
  ];

  for (const skill of skills) {
    const paths = [
      path.join(root, '.opencode', 'skills', skill, 'SKILL.md'),
      path.join(root, '.agents', 'skills', skill, 'SKILL.md'),
    ];
    const found = paths.some(p => fs.existsSync(p));
    assert.ok(found, `Missing SKILL.md for: ${skill}`);
  }
});

test('workspace has OpenCode agent definitions and prompts', () => {
  const agentDir = path.join(root, '.opencode', 'agents');
  assert.ok(fs.existsSync(agentDir), 'Missing .opencode/agents directory');
  assert.ok(fs.existsSync(path.join(agentDir, 'architect.md')), 'Missing architect agent');

  const promptsDir = path.join(root, '.opencode', 'prompts');
  assert.ok(fs.existsSync(promptsDir), 'Missing .opencode/prompts directory');
  assert.ok(fs.existsSync(path.join(promptsDir, 'architect-system.txt')), 'Missing architect prompt');
  assert.ok(fs.existsSync(path.join(promptsDir, 'code-review-checklist.txt')), 'Missing code review prompt');
});

test('workspace has commitlint config', () => {
  assert.ok(
    fs.existsSync(path.join(root, '.commitlintrc.json')),
    'Missing .commitlintrc.json'
  );
});

test('workspace has knip config', () => {
  assert.ok(
    fs.existsSync(path.join(root, 'knip.json')),
    'Missing knip.json'
  );
});

test('workspace has changesets config', () => {
  assert.ok(
    fs.existsSync(path.join(root, '.changeset', 'config.json')),
    'Missing .changeset/config.json'
  );
});

test('workspace has git-blame-ignore-revs', () => {
  assert.ok(
    fs.existsSync(path.join(root, '.git-blame-ignore-revs')),
    'Missing .git-blame-ignore-revs'
  );
});

test('workspace has docker-compose.yml', () => {
  assert.ok(
    fs.existsSync(path.join(root, 'docker-compose.yml')),
    'Missing docker-compose.yml'
  );
});

test('workspace has Makefile', () => {
  assert.ok(
    fs.existsSync(path.join(root, 'Makefile')),
    'Missing Makefile'
  );
});

test('workspace has Justfile', () => {
  assert.ok(
    fs.existsSync(path.join(root, 'Justfile')),
    'Missing Justfile'
  );
});

test('workspace has root .mcp.json', () => {
  assert.ok(
    fs.existsSync(path.join(root, '.mcp.json')),
    'Missing .mcp.json'
  );
});

test('workspace has CLAUDE.md', () => {
  assert.ok(
    fs.existsSync(path.join(root, 'CLAUDE.md')),
    'Missing CLAUDE.md'
  );
});

test('workspace-has-root-copilot-instructions', () => {
  assert.ok(
    fs.existsSync(path.join(root, '.github', 'copilot-instructions.md')),
    'Missing .github/copilot-instructions.md'
  );
});

test('opencode has custom plugin files', () => {
  const pluginsDir = path.join(root, '.opencode', 'plugins');
  assert.ok(fs.existsSync(pluginsDir), 'Missing .opencode/plugins directory');
  const files = fs.readdirSync(pluginsDir);
  assert.ok(files.some(f => f.endsWith('.ts') || f.endsWith('.js')), 'No plugin files found');
  assert.ok(fs.existsSync(path.join(pluginsDir, 'workspace-enforcer.ts')), 'Missing workspace-enforcer plugin');
});

test('opencode has npm plugins configured', () => {
  const pkgPath = path.join(root, '.opencode', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const required = [
    'opencode-supermemory',
    'opencode-notify',
    'opencode-vibeguard',
    'opencode-conductor',
    'opencode-scheduler',
    'opencode-background-agents',
    'opencode-wakatime',
    'opencode-models-discovery',
    '@tarquinen/opencode-dcp',
    '@cortexkit/opencode-magic-context',
    '@langfuse/opencode-observability-plugin',
    'orca-opencode-plugin',
  ];
  for (const p of required) {
    assert.ok(pkg.dependencies?.[p], `Missing npm plugin dependency: ${p}`);
  }
});

test('opencode config has 16+ agents (including metacognitive agents)', () => {
  const cfgPath = path.join(root, '.opencode', 'opencode.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  const agentCount = Object.keys(cfg.agent || {}).length;
  assert.ok(agentCount >= 16, `Expected 16+ agents, got ${agentCount}`);
  assert.ok(cfg.agent.researcher, 'Missing researcher agent');
  assert.ok(cfg.agent['codebase-explorer'], 'Missing codebase-explorer agent');
  assert.ok(cfg.agent.debugger, 'Missing debugger agent');
  assert.ok(cfg.agent['codebase-qa'], 'Missing codebase-qa agent');
  assert.ok(cfg.agent['devops-engineer'], 'Missing devops-engineer agent');
  assert.ok(cfg.agent['meta-critic'], 'Missing meta-critic meta-cognition agent');
  assert.ok(cfg.agent.verifier, 'Missing verifier critical-thinking agent');
  assert.ok(cfg.agent['self-evolver'], 'Missing self-evolver agent');
  assert.ok(cfg.agent['reasoning-engineer'], 'Missing reasoning-engineer external reasoning agent');
});

test('opencode config has no user commands (zero-user-command model)', () => {
  const cfgPath = path.join(root, '.opencode', 'opencode.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  const cmdCount = Object.keys(cfg.commands || {}).length;
  assert.ok(cmdCount === 0, `Expected 0 commands (all removed), got ${cmdCount}`);
});

test('opencode config has MCP servers with per-agent scoping', () => {
  const cfgPath = path.join(root, '.opencode', 'opencode.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  const servers = cfg.mcp?.servers || {};
  assert.ok(servers.github, 'Missing github MCP server');
  assert.ok(servers.git, 'Missing git MCP server');
  assert.ok(servers.filesystem, 'Missing filesystem MCP server');
  assert.ok(servers.fetch, 'Missing fetch MCP server');
  assert.ok(servers.desktopCommander || servers['desktop-commander'], 'Missing desktop-commander MCP server');
  assert.ok(servers.postgres, 'Missing postgres MCP server');
});

test('opencode has custom tools directory with tool files', () => {
  const toolsDir = path.join(root, '.opencode', 'tools');
  assert.ok(fs.existsSync(toolsDir), 'Missing .opencode/tools directory');
  const files = fs.readdirSync(toolsDir);
  assert.ok(files.some(f => f.endsWith('.ts')), 'No tool TypeScript files found');
  assert.ok(files.includes('codebase-search.ts'), 'Missing codebase-search tool');
  assert.ok(files.includes('workspace.ts'), 'Missing workspace tool');
  assert.ok(files.includes('knowledge.ts'), 'Missing knowledge tool');
});

test('opencode has agent system prompt files for key agents', () => {
  const agentsDir = path.join(root, '.opencode', 'agents');
  const required = [
    'architect.md',
    'debugger.md',
    'researcher.md',
    'codebase-explorer.md',
    'codebase-qa.md',
    'security-auditor.md',
    'test-engineer.md',
  ];
  for (const file of required) {
    assert.ok(fs.existsSync(path.join(agentsDir, file)), `Missing agent prompt: ${file}`);
  }
});

test('opencode has metacognitive agent prompt files', () => {
  const agentsDir = path.join(root, '.opencode', 'agents');
  const required = [
    'meta-critic.md',
    'verifier.md',
    'self-evolver.md',
    'reasoning-engineer.md',
  ];
  for (const file of required) {
    assert.ok(fs.existsSync(path.join(agentsDir, file)), `Missing metacognitive agent prompt: ${file}`);
  }
});

test('opencode has custom tool files for metacognition, critical thinking, evolution, reasoning, orchestration', () => {
  const toolsDir = path.join(root, '.opencode', 'tools');
  const required = [
    'meta-cognition.ts',
    'critical-thinking.ts',
    'self-evolution.ts',
    'reasoning-engine.ts',
    'orchestration.ts',
  ];
  for (const file of required) {
    assert.ok(fs.existsSync(path.join(toolsDir, file)), `Missing tool module: ${file}`);
  }
});

test('opencode has memory databases for metacognitive systems', () => {
  const memoryDir = path.join(root, '.opencode', 'memory');
  assert.ok(fs.existsSync(path.join(memoryDir, 'reflections.json')), 'Missing reflections.json');
  assert.ok(fs.existsSync(path.join(memoryDir, 'mistake-db.json')), 'Missing mistake-db.json');
  assert.ok(fs.existsSync(path.join(memoryDir, 'experience-db.json')), 'Missing experience-db.json');
  assert.ok(fs.existsSync(path.join(memoryDir, 'skill-registry.json')), 'Missing skill-registry.json');
});

test('opencode has self-evolution skill definition', () => {
  assert.ok(
    fs.existsSync(path.join(root, '.opencode', 'skills', 'self-evolution', 'SKILL.md')),
    'Missing self-evolution skill'
  );
});

test('opencode agent config prompts reference existing files', () => {
  const cfgPath = path.join(root, '.opencode', 'opencode.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  const agents = cfg.agent || {};
  for (const [name, agent] of Object.entries(agents)) {
    if (agent.prompt && typeof agent.prompt === 'string' && agent.prompt.startsWith('{file:')) {
      const filePath = agent.prompt.replace('{file:', '').replace('}', '');
      const absPath = path.resolve(path.dirname(cfgPath), filePath);
      assert.ok(fs.existsSync(absPath), `Agent "${name}" references missing prompt file: ${filePath}`);
    }
  }
});

test('opencode config has references section including metacognitive protocol', () => {
  const cfgPath = path.join(root, '.opencode', 'opencode.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  assert.ok(cfg.references, 'Missing references section');
  assert.ok(cfg.references.docs, 'Missing docs reference');
  assert.ok(cfg.references.shared, 'Missing shared reference');
  assert.ok(cfg.references['autonomous-capabilities'], 'Missing autonomous-capabilities hidden reference');
});

test('opencode has autonomous capabilities protocol instructions file', () => {
  assert.ok(
    fs.existsSync(path.join(root, '.opencode', 'references', 'autonomous-capabilities.md')),
    'Missing autonomous-capabilities.md protocol file'
  );
});

test('opencode instructions array includes autonomous-capabilities', () => {
  const cfgPath = path.join(root, '.opencode', 'opencode.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  assert.ok(Array.isArray(cfg.instructions), 'Missing instructions array');
  assert.ok(
    cfg.instructions.some((i) => typeof i === 'string' && i.includes('autonomous-capabilities')),
    'autonomous-capabilities.md not in instructions array'
  );
});

test('opencode config has LSP configuration', () => {
  const cfgPath = path.join(root, '.opencode', 'opencode.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  assert.ok(cfg.lsp, 'Missing lsp section');
  assert.ok(cfg.lsp.typescript || cfg.lsp.typescript, 'Missing TypeScript LSP');
});

test('opencode config has policies section', () => {
  const cfgPath = path.join(root, '.opencode', 'opencode.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  assert.ok(cfg.experimental?.policies, 'Missing experimental.policies section');
  assert.ok(cfg.experimental.policies.length > 0, 'No policies defined');
});

test('claude has claude.json project config', () => {
  assert.ok(
    fs.existsSync(path.join(root, '.claude', 'claude.json')),
    'Missing .claude/claude.json'
  );
});

test('claude has settings.json with hooks', () => {
  const settingsPath = path.join(root, '.claude', 'settings.json');
  assert.ok(fs.existsSync(settingsPath), 'Missing .claude/settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  assert.ok(settings.hooks, 'Missing hooks in claude settings');
  assert.ok(settings.hooks.PostToolUse, 'Missing PostToolUse hooks');
});

test('project-starter template is comprehensive', () => {
  const starter = path.join(root, 'templates', 'project-starter');
  assert.ok(fs.existsSync(starter), 'Missing templates/project-starter');
  assert.ok(fs.existsSync(path.join(starter, 'apps', 'web', 'src', 'main.tsx')), 'Missing web main.tsx');
  assert.ok(fs.existsSync(path.join(starter, 'apps', 'api', 'src', 'index.ts')), 'Missing api index.ts');
  assert.ok(fs.existsSync(path.join(starter, 'packages', 'shared', 'src', 'index.ts')), 'Missing shared index.ts');
  assert.ok(fs.existsSync(path.join(starter, 'packages', 'db', 'prisma')), 'Missing db prisma dir');
  assert.ok(fs.existsSync(path.join(starter, 'docs', 'ADR', 'template.md')), 'Missing ADR template');
  assert.ok(fs.existsSync(path.join(starter, 'docker-compose.yml')), 'Missing starter docker-compose');
  assert.ok(fs.existsSync(path.join(starter, '.devcontainer', 'devcontainer.json')), 'Missing starter devcontainer');
});
