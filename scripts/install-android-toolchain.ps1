$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ToolsDir = Join-Path $ProjectRoot "tools"
$JdkDir = Join-Path $ToolsDir "jdk-17"
$AndroidSdkRoot = Join-Path $ToolsDir "android-sdk"
$CmdlineLatest = Join-Path $AndroidSdkRoot "cmdline-tools\latest"
$DownloadsDir = Join-Path $ToolsDir "downloads"

function Download-File($Url, $OutFile) {
  if (Test-Path $OutFile) {
    return
  }
  Write-Host "Baixando: $Url"
  if (!(Test-Path (Split-Path -Parent $OutFile))) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $OutFile) -Force | Out-Null
  }
  & curl.exe -L --fail --connect-timeout 30 --max-time 900 -o $OutFile $Url
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao baixar $Url"
  }
}

function Install-Jdk {
  if (Test-Path (Join-Path $JdkDir "bin\java.exe")) {
    return
  }
  $zip = Join-Path $DownloadsDir "jdk17.zip"
  Download-File `
    "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk" `
    $zip

  $extractDir = Join-Path $ToolsDir "jdk17-extract"
  Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
  Expand-Archive -Path $zip -DestinationPath $extractDir -Force
  $root = Get-ChildItem $extractDir -Directory | Select-Object -First 1
  if (!$root) {
    throw "JDK baixado, mas pasta raiz nao encontrada."
  }
  Remove-Item $JdkDir -Recurse -Force -ErrorAction SilentlyContinue
  Copy-Item $root.FullName $JdkDir -Recurse -Force
  Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
}

function Install-AndroidSdk {
  if (!(Test-Path (Join-Path $CmdlineLatest "bin\sdkmanager.bat"))) {
    $zip = Join-Path $DownloadsDir "android-commandlinetools.zip"
    Download-File `
      "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" `
      $zip

    $extractDir = Join-Path $ToolsDir "android-cmdline-extract"
    Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
    Expand-Archive -Path $zip -DestinationPath $extractDir -Force

    Remove-Item $CmdlineLatest -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path (Split-Path -Parent $CmdlineLatest) -Force | Out-Null
    Copy-Item (Join-Path $extractDir "cmdline-tools") $CmdlineLatest -Recurse -Force
    Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
  }

  $env:JAVA_HOME = $JdkDir
  $env:ANDROID_HOME = $AndroidSdkRoot
  $env:ANDROID_SDK_ROOT = $AndroidSdkRoot
  $env:Path = "$JdkDir\bin;$CmdlineLatest\bin;$AndroidSdkRoot\platform-tools;$env:Path"

  $sdkmanager = Join-Path $CmdlineLatest "bin\sdkmanager.bat"
  Write-Host "Aceitando licencas Android SDK..."
  cmd /c "for /l %i in (1,1,80) do @echo y" | & $sdkmanager --licenses --sdk_root=$AndroidSdkRoot

  Write-Host "Instalando pacotes Android SDK..."
  & $sdkmanager --sdk_root=$AndroidSdkRoot "platform-tools" "platforms;android-36" "build-tools;36.0.0"
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao instalar pacotes Android SDK."
  }
}

New-Item -ItemType Directory -Path $ToolsDir, $DownloadsDir -Force | Out-Null
Install-Jdk
Install-AndroidSdk

Write-Host ""
Write-Host "Toolchain Android instalada localmente."
Write-Host "JAVA_HOME=$JdkDir"
Write-Host "ANDROID_HOME=$AndroidSdkRoot"
