param(
  [Parameter(Mandatory = $true)]
  [string]$Name
)

$source = Join-Path $PSScriptRoot '..\templates\project-starter'
$targetRoot = Join-Path (Join-Path $PSScriptRoot '..\projects') $Name

if (Test-Path $targetRoot) {
  throw "A project named '$Name' already exists."
}

New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
Copy-Item -Path (Join-Path $source '*') -Destination $targetRoot -Recurse -Force

$packagePath = Join-Path $targetRoot 'package.json'
if (Test-Path $packagePath) {
  $content = Get-Content $packagePath -Raw
  $safeName = ($Name.ToLowerInvariant() -replace '[^a-z0-9]+', '-') -replace '^-|-$', ''
  $content = $content -replace 'project-starter-template', "${safeName}-template"
  Set-Content -Path $packagePath -Value $content
}

$readmePath = Join-Path $targetRoot 'README.md'
if (Test-Path $readmePath) {
  Set-Content -Path $readmePath -Value "# $Name`n`nThis project was scaffolded from the workspace starter template.`n"
}

Write-Host "Created project scaffold at $targetRoot"
