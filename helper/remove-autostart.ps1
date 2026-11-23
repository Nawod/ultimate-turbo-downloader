# Removes the Startup-folder shortcut that setup.ps1 -Autostart created.
$startup = [Environment]::GetFolderPath('Startup')
$found = $false
foreach ($name in 'Ultimate Turbo Downloader.lnk', 'Turbo Downloader (aria2).lnk') {
  $lnk = Join-Path $startup $name
  if (Test-Path $lnk) { Remove-Item $lnk; $found = $true }
}
if ($found) { Write-Host 'Autostart removed.' } else { Write-Host 'Autostart was not set.' }
