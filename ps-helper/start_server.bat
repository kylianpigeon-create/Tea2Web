@echo off
rem start_server.bat - lance start_server.ps1
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start_server.ps1"
start "" "https://www.thes-traditions.com/dev/interface.php?token=2025"
