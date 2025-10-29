# start_server.ps1
# Lancer "node server.js" en arrière-plan (fenêtre cachée), enregistrer le PID, puis ouvrir l'URL.
$ErrorActionPreference = "Stop"

# Aller dans le dossier du script (mettez ce fichier à côté de server.js)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Démarrer le serveur Node en arrière-plan
$proc = Start-Process -FilePath "node" -ArgumentList "server.js" -WindowStyle Hidden -PassThru

# Enregistrer le PID pour pouvoir l'arrêter proprement
$pidFile = Join-Path $ScriptDir "server.pid"
$proc.Id | Out-File -FilePath $pidFile -Encoding ascii -Force

# (Optionnel) Attendre une seconde
Start-Sleep -Seconds 1

# Ouvrir la page web demandée dans le navigateur par défaut
Start-Process "https://www.thes-traditions.com/dev/interface.php?token=2025"
