$ErrorActionPreference = "Stop"
$Pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $Pasta

try {
  & py -3.11 --version
} catch {
  Write-Host "Python 3.11 não foi encontrado. Instale-o para este usuário e execute novamente." -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path -LiteralPath ".venv")) {
  & py -3.11 -m venv .venv
}

& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt

if (-not (Test-Path -LiteralPath ".env.worker")) {
  Copy-Item -LiteralPath ".env.worker.example" -Destination ".env.worker"
}

Write-Host ""
Write-Host "Instalação concluída." -ForegroundColor Green
Write-Host "Preencha .env.worker e depois execute iniciar_worker.bat."
