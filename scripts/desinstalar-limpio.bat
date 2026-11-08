@echo off
setlocal
cd /d "%~dp0"
title Desinstalacion limpia UVECOE

echo.
echo Este proceso desinstala UVECOE, hace backup de la DB en el escritorio
echo y elimina los datos locales de la aplicacion.
echo.
echo Para quitar tambien el certificado interno, ejecuta este .bat como
echo administrador y usa:
echo   powershell -ExecutionPolicy Bypass -File uninstall-clean.ps1 -RemoveCertificate
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-clean.ps1" %*

echo.
pause
endlocal
