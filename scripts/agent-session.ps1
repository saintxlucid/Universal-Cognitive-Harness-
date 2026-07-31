[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('start', 'note', 'complete', 'blocked')]
  [string]$Status,

  [Parameter(Mandatory = $true)]
  [string]$Runtime,

  [Parameter(Mandatory = $true)]
  [string]$Scope,

  [Parameter(Mandatory = $true)]
  [string]$Summary
)

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$logPath = Join-Path $workspaceRoot '.agent/memory/SESSION-LOG.md'

if ($Summary -match '(?i)(api[_ -]?key|password|secret|token)') {
  throw 'Do not record secrets or credentials in the shared session log.'
}

$timestamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$safeRuntime = $Runtime.Trim() -replace '[\r\n|]', ' '
$safeScope = $Scope.Trim() -replace '[\r\n|]', ' '
$safeSummary = $Summary.Trim() -replace '[\r\n|]', ' '

Add-Content -LiteralPath $logPath -Value "$timestamp | $safeRuntime | $Status | $safeScope | $safeSummary"
Write-Output "Recorded $Status session entry in $logPath"
