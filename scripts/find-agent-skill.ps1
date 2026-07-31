[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Query,

  [ValidateRange(1, 100)]
  [int]$Limit = 20
)

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$vendorRoot = Join-Path $workspaceRoot '.agent/vendor'
$sourceManifest = Join-Path $vendorRoot 'SOURCES.json'
$terms = $Query.ToLowerInvariant().Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)

if (-not (Test-Path -LiteralPath $sourceManifest)) {
  throw 'The imported capability library is not available.'
}

$sourceDirectories = (Get-Content -Raw -LiteralPath $sourceManifest | ConvertFrom-Json).sources.directory
$matches = $sourceDirectories | ForEach-Object {
  $sourceRoot = Join-Path $vendorRoot $_
  Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -Filter 'SKILL.md'
} |
  ForEach-Object {
    $content = Get-Content -Raw -LiteralPath $_.FullName
    $score = 0
    foreach ($term in $terms) {
      if ($content.ToLowerInvariant().Contains($term)) { $score++ }
    }
    if ($score -gt 0) {
      [PSCustomObject]@{
        Score = $score
        Source = $_.FullName.Substring($vendorRoot.Length + 1).Split([IO.Path]::DirectorySeparatorChar)[0]
        Path = $_.FullName
      }
    }
  } |
  Sort-Object @{ Expression = 'Score'; Descending = $true }, Source, Path |
  Select-Object -First $Limit

if (-not $matches) {
  Write-Output "No imported skill matched: $Query"
  exit 1
}

$matches | Format-Table Score, Source, Path -AutoSize
