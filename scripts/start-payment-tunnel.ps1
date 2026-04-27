$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $ProjectRoot ".env"
$TunnelLog = Join-Path $ProjectRoot ".cloudflared.log"
$TunnelErr = Join-Path $ProjectRoot ".cloudflared.err.log"

function Stop-PortProcess($Port) {
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    if ($processId -and $processId -ne $PID) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Set-EnvValue($Path, $Name, $Value) {
  if (!(Test-Path $Path)) {
    New-Item -ItemType File -Path $Path -Force | Out-Null
  }
  $content = Get-Content $Path -Raw
  $line = "$Name=$Value"
  if ($content -match "(?m)^$Name=") {
    $content = $content -replace "(?m)^$Name=.*$", $line
  } else {
    if ($content.Length -gt 0 -and !$content.EndsWith("`n")) {
      $content += "`r`n"
    }
    $content += "$line`r`n"
  }
  Set-Content -Path $Path -Value $content -Encoding UTF8
}

function Find-Cloudflared {
  $candidates = @(
    (Join-Path $ProjectRoot "tools\cloudflared.exe"),
    (Join-Path $env:USERPROFILE "Downloads\cloudflared.exe"),
    (Join-Path $env:USERPROFILE "Downloads\cloudflared-windows-amd64.exe"),
    "C:\cloudflared\cloudflared.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }
  return $null
}

function Install-Cloudflared {
  $toolsDir = Join-Path $ProjectRoot "tools"
  $target = Join-Path $toolsDir "cloudflared.exe"
  if (!(Test-Path $toolsDir)) {
    New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
  }
  Write-Host "cloudflared.exe nao encontrado. Baixando automaticamente..."
  $url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($curl) {
    & curl.exe -L --fail --connect-timeout 20 --max-time 180 -o $target $url
    if ($LASTEXITCODE -ne 0) {
      throw "Falha ao baixar cloudflared.exe com curl."
    }
  } else {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $target -TimeoutSec 180
  }
  if (!(Test-Path $target)) {
    throw "Nao foi possivel baixar o cloudflared.exe."
  }
  return $target
}

Set-Location $ProjectRoot

Write-Host ""
Write-Host "Verificando dependencias..."
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "Node.js/npm nao foi encontrado."
}

$cloudflared = Find-Cloudflared
if (!$cloudflared) {
  $cloudflared = Install-Cloudflared
}

if (!(Test-Path (Join-Path $ProjectRoot "node_modules"))) {
  Write-Host "Instalando dependencias..."
  npm install
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao instalar dependencias."
  }
}

Write-Host ""
Write-Host "Limpando processos antigos..."
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Stop-PortProcess 3334
Stop-PortProcess 5173

Write-Host ""
Write-Host "Atualizando banco de dados..."
npm run db:setup
if ($LASTEXITCODE -ne 0) {
  throw "Falha ao preparar o banco de dados."
}

Remove-Item $TunnelLog, $TunnelErr -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Abrindo tunel HTTPS do Cloudflare..."
$tunnel = Start-Process `
  -FilePath $cloudflared `
  -ArgumentList @("tunnel", "--url", "http://127.0.0.1:3334") `
  -RedirectStandardOutput $TunnelLog `
  -RedirectStandardError $TunnelErr `
  -WindowStyle Hidden `
  -PassThru

$publicUrl = $null
for ($attempt = 0; $attempt -lt 40; $attempt++) {
  Start-Sleep -Milliseconds 500
  $combined = ""
  if (Test-Path $TunnelLog) {
    $combined += Get-Content $TunnelLog -Raw -ErrorAction SilentlyContinue
  }
  if (Test-Path $TunnelErr) {
    $combined += "`n" + (Get-Content $TunnelErr -Raw -ErrorAction SilentlyContinue)
  }
  $match = [regex]::Match($combined, "https://[-a-zA-Z0-9.]+\.trycloudflare\.com")
  if ($match.Success) {
    $publicUrl = $match.Value
    break
  }
  if ($tunnel.HasExited) {
    throw "cloudflared fechou antes de gerar a URL. Veja .cloudflared.err.log."
  }
}

if (!$publicUrl) {
  throw "Nao foi possivel encontrar a URL HTTPS do Cloudflare."
}

Set-EnvValue $EnvPath "API_BASE_URL" $publicUrl

$webhookUrl = "$publicUrl/api/payments/mercado-pago/webhook"

Write-Host ""
Write-Host "========================================"
Write-Host "TUNEL HTTPS ATIVO"
Write-Host "========================================"
Write-Host "API HTTPS:   $publicUrl"
Write-Host "Webhook MP:  $webhookUrl"
Write-Host "Site local:  http://127.0.0.1:5173"
Write-Host ""
Write-Host "Cole no Mercado Pago:"
Write-Host $webhookUrl
Write-Host ""
Write-Host "IMPORTANTE: mantenha esta janela aberta."
Write-Host "Ao fechar, o webhook para de funcionar e a URL muda no proximo inicio."
Write-Host ""

try {
  npm run dev
} finally {
  if ($tunnel -and !$tunnel.HasExited) {
    Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
  }
}
