[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$KeepData,
  [switch]$RemoveCertificate,
  [string]$BackupDir = (Join-Path ([Environment]::GetFolderPath("Desktop")) "UVECOE-backup"),
  [string]$CertificateThumbprint = "B09EC007BDCC8A7C4E9968973C7F3EE7E852C83D"
)

$ErrorActionPreference = "Stop"

$appName = "UVECOE"
$installDirDefault = Join-Path $env:LOCALAPPDATA "Programs\UVECOE"
$userDataDir = Join-Path $env:APPDATA "uvecoe"
$localDataDir = Join-Path $env:LOCALAPPDATA "uvecoe"

Write-Host "== UVECOE: desinstalacion limpia ==" -ForegroundColor Cyan

# 1. Cerrar la aplicacion
Get-Process UVECOE -ErrorAction SilentlyContinue | ForEach-Object {
  if ($PSCmdlet.ShouldProcess("PID $($_.Id)", "Detener proceso UVECOE")) {
    Stop-Process -Id $_.Id -Force
  }
}
Start-Sleep -Seconds 2

# 2. Backup de la DB antes de borrar datos
$db = Join-Path $userDataDir "uvecoe.db"
if (!$KeepData -and (Test-Path $db)) {
  if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  }

  $destination = Join-Path $BackupDir ("uvecoe-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".db")

  if ($PSCmdlet.ShouldProcess($destination, "Copiar backup de uvecoe.db")) {
    Copy-Item $db $destination -Force
    Write-Host "Backup de la DB: $destination" -ForegroundColor Green
  }
}

# 3. Localizar y ejecutar el desinstalador
$uninstaller = Get-ChildItem $installDirDefault -Filter "Uninstall*.exe" -ErrorAction SilentlyContinue |
  Select-Object -First 1

if (!$uninstaller) {
  $entry = Get-ChildItem "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction SilentlyContinue |
    ForEach-Object { Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue } |
    Where-Object { $_.DisplayName -like "*$appName*" } |
    Select-Object -First 1

  if ($entry -and $entry.UninstallString) {
    $uninstallerPath = ($entry.UninstallString -replace '"', "").Trim()
    if (Test-Path $uninstallerPath) {
      $uninstaller = Get-Item $uninstallerPath
    }
  }
}

if ($uninstaller) {
  if ($PSCmdlet.ShouldProcess($uninstaller.FullName, "Ejecutar desinstalador (/S)")) {
    Start-Process -FilePath $uninstaller.FullName -ArgumentList "/S" -Wait
  }
} else {
  Write-Host "No se encontro el desinstalador. Puede que ya este desinstalada." -ForegroundColor Yellow
}
Start-Sleep -Seconds 2

# 4. Restos de la carpeta de instalacion
if (Test-Path $installDirDefault) {
  if ($PSCmdlet.ShouldProcess($installDirDefault, "Eliminar carpeta de instalacion")) {
    Remove-Item $installDirDefault -Recurse -Force
  }
}

# 5. Datos locales (DB, configuracion y caches)
if (!$KeepData) {
  foreach ($dir in @($userDataDir, $localDataDir)) {
    if (Test-Path $dir) {
      if ($PSCmdlet.ShouldProcess($dir, "Eliminar datos locales")) {
        Remove-Item $dir -Recurse -Force
      }
    }
  }
} else {
  Write-Host "Se conservan los datos locales en: $userDataDir" -ForegroundColor Yellow
}

# 6. Accesos directos
$shortcuts = @(
  (Join-Path $env:USERPROFILE "Desktop\UVECOE.lnk"),
  (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\UVECOE.lnk")
)

foreach ($shortcut in $shortcuts) {
  if (Test-Path $shortcut) {
    if ($PSCmdlet.ShouldProcess($shortcut, "Eliminar acceso directo")) {
      Remove-Item $shortcut -Force
    }
  }
}

# 7. Entradas de desinstalacion residuales
$uninstallKeys = Get-ChildItem "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction SilentlyContinue |
  Where-Object { (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).DisplayName -like "*$appName*" }

foreach ($key in $uninstallKeys) {
  if ($PSCmdlet.ShouldProcess($key.PSPath, "Eliminar entrada de desinstalacion")) {
    Remove-Item $key.PSPath -Recurse -Force
  }
}

# 8. Certificado interno (opcional)
if ($RemoveCertificate) {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )

  if (!$isAdmin) {
    throw "Para -RemoveCertificate ejecuta PowerShell como administrador."
  }

  $stores = @(
    "Cert:\LocalMachine\Root",
    "Cert:\LocalMachine\TrustedPublisher",
    "Cert:\CurrentUser\Root",
    "Cert:\CurrentUser\TrustedPublisher",
    "Cert:\CurrentUser\My"
  )

  foreach ($store in $stores) {
    Get-ChildItem $store -ErrorAction SilentlyContinue |
      Where-Object { $_.Thumbprint -eq $CertificateThumbprint } |
      ForEach-Object {
        if ($PSCmdlet.ShouldProcess($_.Thumbprint, "Eliminar certificado de $store")) {
          Remove-Item $_.PSPath -Force
        }
      }
  }
}

Write-Host "== Fin ==" -ForegroundColor Cyan
