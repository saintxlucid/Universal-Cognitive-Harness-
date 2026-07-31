[CmdletBinding()]
param()

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$memoryPath = Join-Path $workspaceRoot '.agent/memory/WORKSPACE-MEMORY.md'
$logPath = Join-Path $workspaceRoot '.agent/memory/SESSION-LOG.md'
$skillRoot = Join-Path $workspaceRoot '.agents/skills'
$vendorRoot = Join-Path $workspaceRoot '.agent/vendor'
$sourceManifest = Join-Path $vendorRoot 'SOURCES.json'

Write-Output 'Shared Agent Harness'
Write-Output "Workspace: $workspaceRoot"
Write-Output "Local skills: $(@(Get-ChildItem -LiteralPath $skillRoot -Directory).Count)"
Write-Output "Imported sources: $(@((Get-Content -Raw -LiteralPath $sourceManifest | ConvertFrom-Json).sources).Count)"
Write-Output ''
Write-Output 'Durable memory'
Get-Content -LiteralPath $memoryPath | Select-Object -First 40
Write-Output ''
Write-Output 'Recent session entries'
Get-Content -LiteralPath $logPath | Select-Object -Last 5
