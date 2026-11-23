# Stops aria2 (saving unfinished downloads so they resume next time) and the video helper.
param([switch]$Quiet)
$here = $PSScriptRoot
$secretFile = Join-Path $here 'secret.txt'
if (Test-Path $secretFile) {
  $secret = (Get-Content $secretFile -Raw).Trim()
  $body = @{ jsonrpc = '2.0'; id = '1'; method = 'aria2.shutdown'; params = @("token:$secret") } | ConvertTo-Json
  try { Invoke-RestMethod -Uri 'http://127.0.0.1:6800/jsonrpc' -Method Post -Body $body -ContentType 'application/json' | Out-Null; Start-Sleep -Milliseconds 800 } catch {}
}
Get-Process aria2c -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*media-server.mjs*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
if (-not $Quiet) { Write-Host 'Ultimate Turbo Downloader helpers stopped.' }
