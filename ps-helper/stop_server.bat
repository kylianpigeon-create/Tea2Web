@echo off
rem stop_server.bat - lance stop_server.ps1
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0stop_server.ps1"
