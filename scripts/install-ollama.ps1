$markerDir = Join-Path $env:LOCALAPPDATA 'Ollama'
if (-not (Test-Path $markerDir)) {
    New-Item -ItemType Directory -Path $markerDir -Force | Out-Null
}
$markerFile = Join-Path $markerDir 'upgraded'
New-Item -ItemType File -Path $markerFile -Force | Out-Null

$installer = Join-Path $env:TEMP 'OllamaSetup.exe'
Write-Host "Iniciando instalador silencioso do Ollama..."
$proc = Start-Process -FilePath $installer -ArgumentList '/VERYSILENT /NORESTART /SUPPRESSMSGBOXES' -PassThru
$proc.WaitForExit()
Write-Host "Instalação concluída com código:" $proc.ExitCode
