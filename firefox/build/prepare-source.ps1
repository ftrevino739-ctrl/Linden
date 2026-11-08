[CmdletBinding()]
param(
  [string]$SourceDirectory = (Join-Path $HOME "mozilla-central"),
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\.." )).Path
)
$ErrorActionPreference = "Stop"
Write-Host "Linden / Firefox source preparation" -ForegroundColor Cyan
Write-Host "This downloads Mozilla source; it does not modify your existing Firefox installation."
if (-not (Get-Command hg -ErrorAction SilentlyContinue)) {
  throw "Mercurial (hg) was not found. Install MozillaBuild from Mozilla's official Windows build guide, open its MozillaBuild shell, and run this script there."
}
if (Test-Path $SourceDirectory) {
  if (-not (Test-Path (Join-Path $SourceDirectory "mach"))) { throw "The target folder exists but is not a Mozilla source checkout: $SourceDirectory" }
  Write-Host "Using existing Mozilla source checkout: $SourceDirectory"
} else {
  Write-Host "Cloning Mozilla mozilla-central. This is a large download and may take a long time."
  hg clone https://hg.mozilla.org/mozilla-central $SourceDirectory
  if ($LASTEXITCODE -ne 0) { throw "Mercurial clone failed with exit code $LASTEXITCODE" }
}
Copy-Item (Join-Path $RepositoryRoot "firefox\build\mozconfig.win") (Join-Path $SourceDirectory ".mozconfig") -Force
Write-Host "Prepared source: $SourceDirectory"
Write-Host "Next: from the MozillaBuild shell, cd to this directory and run ./mach build"
Write-Host "A complete optimized Windows build requires substantial disk space, RAM, and build time."
