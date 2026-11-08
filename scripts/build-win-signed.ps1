param(
  [string]$CertPath = "C:\Users\scubero\uvecoe-certs\uvecoe-code-signing.pfx",
  [string]$PasswordFile = "C:\Users\scubero\uvecoe-certs\pfx-password.txt"
)

$ErrorActionPreference = "Stop"

# Ejecutar siempre desde la raíz del proyecto, aunque se invoque desde scripts\.
Set-Location (Split-Path -Parent $PSScriptRoot)

if (!(Test-Path $CertPath)) {
  throw "No existe el certificado: $CertPath"
}

if (!(Test-Path $PasswordFile)) {
  throw "No existe el fichero de contraseña: $PasswordFile"
}

$env:CSC_LINK = (Resolve-Path $CertPath).Path
$env:CSC_KEY_PASSWORD = (Get-Content $PasswordFile -Raw).Trim()

npm run dist:win

if ($LASTEXITCODE -ne 0) {
  throw "La build falló (código $LASTEXITCODE)."
}

$installer = Get-ChildItem -Path "release\UVECOE-*-setup.exe" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (!$installer) {
  throw "No se encontró el instalador en release\."
}

$signature = Get-AuthenticodeSignature -FilePath $installer.FullName
$signature | Format-List Status, StatusMessage, SignerCertificate, TimeStamperCertificate

if ($signature.Status -ne "Valid") {
  throw "La firma no es válida: $($signature.Status) - $($signature.StatusMessage)"
}

Write-Output "Instalador firmado: $($installer.FullName)"
