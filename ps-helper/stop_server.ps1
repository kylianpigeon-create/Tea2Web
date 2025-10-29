# stop_server.ps1
# Arrêter proprement le serveur démarré par start_server.ps1
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $ScriptDir "server.pid"

function Stop-NodeByPid($pid) {
    try {
        $p = Get-Process -Id $pid -ErrorAction Stop
        if ($p.ProcessName -like "node*") {
            Stop-Process -Id $pid -ErrorAction SilentlyContinue
        }
    } catch {}
}

# 1) Si on a un PID enregistré
if (Test-Path $pidFile) {
    $pid = Get-Content $pidFile | Select-Object -First 1
    if ($pid) { Stop-NodeByPid $pid }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
} else {
    # 2) Sinon, on tente de trouver un node qui exécute server.js
    try {
        $cims = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "node.exe" -and $_.CommandLine -match "server.js" }
        foreach ($c in $cims) {
            Stop-Process -Id $c.ProcessId -ErrorAction SilentlyContinue
        }
    } catch {}
}
