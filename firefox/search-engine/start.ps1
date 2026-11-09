$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker Desktop no está instalado. Instálalo y vuelve a ejecutar start.ps1."
}

try {
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { throw "Docker no está listo." }
} catch {
    throw "Docker Desktop no está iniciado. Ábrelo, espera a que termine de arrancar y vuelve a ejecutar start.ps1."
}

if (-not (Test-Path ".env")) {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    $secret = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "x").Replace("/", "y")
    $content = Get-Content ".env.example" -Raw
    $content = $content.Replace("replace-this-local-secret", $secret)
    [System.IO.File]::WriteAllText((Join-Path $Root ".env"), $content, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Se creó search-engine/.env con una clave local." -ForegroundColor Green
}

docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw "Docker Compose no pudo iniciar Linden Search. Revisa los mensajes anteriores." }
Write-Host ""
Write-Host "Linden Search está iniciando en http://127.0.0.1:8787/health" -ForegroundColor Green
Write-Host "Comprueba el estado con: docker compose ps"
