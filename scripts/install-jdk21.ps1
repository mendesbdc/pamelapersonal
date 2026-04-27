$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ToolsDir = Join-Path $ProjectRoot "tools"
$DownloadsDir = Join-Path $ToolsDir "downloads"
$JdkDir = Join-Path $ToolsDir "jdk-21"
$ExtractDir = Join-Path $ToolsDir "jdk21-extract"
$ZipPath = Join-Path $DownloadsDir "jdk21.zip"
$DownloadUrl = "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk"

New-Item -ItemType Directory -Path $DownloadsDir -Force | Out-Null

if (!(Test-Path $ZipPath)) {
  Write-Host "Baixando JDK 21..."
  & curl.exe -L --fail --connect-timeout 30 --max-time 900 -o $ZipPath $DownloadUrl
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao baixar JDK 21."
  }
}

Remove-Item $ExtractDir, $JdkDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $ExtractDir -Force | Out-Null

Write-Host "Extraindo JDK 21..."
Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force

$Root = Get-ChildItem $ExtractDir -Directory | Select-Object -First 1
if (!$Root) {
  throw "Pasta raiz do JDK 21 nao encontrada."
}

Copy-Item $Root.FullName $JdkDir -Recurse -Force
Remove-Item $ExtractDir -Recurse -Force -ErrorAction SilentlyContinue

& (Join-Path $JdkDir "bin\java.exe") -version
