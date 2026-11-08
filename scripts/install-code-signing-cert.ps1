#Requires -RunAsAdministrator
param(
  [Parameter(Mandatory = $true)]
  [string]$CertificatePath
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $CertificatePath)) {
  throw "No existe el certificado: $CertificatePath"
}

Import-Certificate -FilePath $CertificatePath -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
Import-Certificate -FilePath $CertificatePath -CertStoreLocation Cert:\LocalMachine\TrustedPublisher | Out-Null

Write-Output "Certificado instalado en LocalMachine\Root y LocalMachine\TrustedPublisher."
Write-Output "Equipo listo para confiar en los instaladores firmados con UVECOE Code Signing."
