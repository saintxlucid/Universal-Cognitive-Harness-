[CmdletBinding()]
param()

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$requiredPaths = @(
  'AGENTS.md',
  'SKILLS.md',
  '.agent',
  '.agents/skills',
  '.mcp.json',
  '.vscode/mcp.json',
  '.agent/memory/workspace-memory.md',
  '.agent/memory/SESSION-LOG.md',
  '.agent/vendor',
  '.agent/harness',
  '.agent/harness/agent-discovery.json',
  '.agent/harness/workspace-agent-harness.mjs',
  'eslint.config.mjs',
  '.github/workflows/ci.yml',
  '.env.example',
  'tests/workspace-config.test.mjs',
  'scripts/agent-bootstrap.ps1',
  'projects',
  'templates/project-starter'
)

$issues = New-Object System.Collections.Generic.List[string]

Write-Output "Workspace: $workspaceRoot"
Write-Output ''
Write-Output 'Required operating surfaces'
foreach ($relativePath in $requiredPaths) {
  $path = Join-Path $workspaceRoot $relativePath
  if (Test-Path -LiteralPath $path) {
    Write-Output "[ok] $relativePath"
  }
  else {
    Write-Output "[missing] $relativePath"
    $issues.Add("Missing required operating surface: $relativePath")
  }
}

Write-Output ''
Write-Output 'Repository foundation'
Push-Location -LiteralPath $workspaceRoot
try {
  $isGitRepository = ((& git rev-parse --is-inside-work-tree 2>$null) | Select-Object -First 1) -eq 'true'
  if ($LASTEXITCODE -eq 0 -and $isGitRepository) {
    Write-Output '[ok] Git repository root'
  }
  else {
    Write-Output '[missing] Git repository root'
    $issues.Add('Workspace root is not a Git repository.')
  }
}
finally {
  Pop-Location
}

Write-Output ''
Write-Output 'Projects'
$projectsRoot = Join-Path $workspaceRoot 'projects'
$projects = @(Get-ChildItem -LiteralPath $projectsRoot -Directory -ErrorAction SilentlyContinue)
if ($projects.Count -eq 0) {
  Write-Output '[missing] No project directories found.'
  $issues.Add('No project directories found.')
}
else {
  foreach ($project in $projects) {
    $manifest = Get-ChildItem -LiteralPath $project.FullName -Recurse -File -Filter 'package.json' -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
      Select-Object -First 1
    $readme = Test-Path -LiteralPath (Join-Path $project.FullName 'README.md')
    $state = if ($manifest) { 'application' } elseif ($readme) { 'documented slot' } else { 'empty slot' }
    Write-Output "[$state] $($project.Name)"
  }
}

Write-Output ''
Write-Output 'MCP baseline'
$codexConfig = Join-Path $workspaceRoot '.codex/config.toml'
if (Test-Path -LiteralPath $codexConfig) {
  $config = Get-Content -Raw -LiteralPath $codexConfig
  foreach ($server in @('openai_developer_docs', 'context7', 'sequential_thinking', 'exa', 'playwright')) {
    if ($config -match "\[mcp_servers\.$server\]") {
      Write-Output "[configured] $server"
    }
    else {
      Write-Output "[not configured] $server"
      $issues.Add("MCP server not configured: $server")
    }
  }
}
else {
  Write-Output '[missing] .codex/config.toml'
}

Write-Output ''
Write-Output 'Cross-runtime integration'
foreach ($relativePath in @('.claude/skills', '.opencode/skills', '.github/copilot-instructions.md')) {
  $path = Join-Path $workspaceRoot $relativePath
  if (Test-Path -LiteralPath $path) {
    Write-Output "[ok] $relativePath"
  }
  else {
    Write-Output "[missing] $relativePath"
    $issues.Add("Missing cross-runtime integration: $relativePath")
  }
}

Write-Output ''
Write-Output 'AI SDK harness'
$harnessScript = Join-Path $workspaceRoot '.agent/harness/workspace-agent-harness.mjs'
if (Test-Path -LiteralPath $harnessScript) {
  Write-Output '[ok] Agent discovery harness and root entrypoint are present'
}
else {
  Write-Output '[missing] AI SDK harness script'
  $issues.Add('AI SDK harness script is missing.')
}

Write-Output ''
if ($issues.Count -eq 0) {
  Write-Output 'Status: ready'
  exit 0
}

Write-Output 'Status: attention needed'
$issues | ForEach-Object { Write-Output "- $_" }
exit 1
