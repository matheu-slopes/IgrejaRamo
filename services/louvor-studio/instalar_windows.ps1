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
if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar as dependências." }
$ToolsPath = Join-Path $Pasta ".tools"
New-Item -ItemType Directory -Path $ToolsPath -Force | Out-Null
$ArchivePath = Join-Path $ToolsPath "rubberband.zip"
if (-not (Test-Path -LiteralPath (Join-Path $ToolsPath "rubberband.exe"))) {
  Invoke-WebRequest -Uri "https://breakfastquay.com/files/releases/rubberband-4.0.0-gpl-executable-windows.zip" -OutFile $ArchivePath
  Expand-Archive -LiteralPath $ArchivePath -DestinationPath $ToolsPath -Force
  $Executable = Get-ChildItem -LiteralPath $ToolsPath -Filter "rubberband.exe" -Recurse | Select-Object -First 1
  if (-not $Executable) { throw "Rubber Band não encontrado no arquivo baixado." }
  if ($Executable.DirectoryName -ne $ToolsPath) {
    Get-ChildItem -LiteralPath $Executable.DirectoryName -File | Copy-Item -Destination $ToolsPath -Force
  }
}
& (Join-Path $ToolsPath "rubberband.exe") --version
if ($LASTEXITCODE -ne 0) { throw "Falha ao executar Rubber Band." }

if (-not (Test-Path -LiteralPath ".env.worker")) {
  Copy-Item -LiteralPath ".env.worker.example" -Destination ".env.worker"
}

Write-Host ""
Write-Host "Instalação concluída." -ForegroundColor Green
Write-Host "Preencha .env.worker e depois execute iniciar_worker.bat."
