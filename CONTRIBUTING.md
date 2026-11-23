# Contributing

Thanks for helping improve Ultimate Turbo Downloader. Bug reports, fixes, and new features are all welcome.

## Getting set up

1. Fork and clone the repository.
2. Run the helper setup (Windows):
   ```powershell
   powershell -ExecutionPolicy Bypass -File helper\setup.ps1 -InstallAria2 -InstallYtDlp
   ```
3. Load `extension/` as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked)
   and paste the secret from `helper\secret.txt` into the extension's Options.

After changing the extension, click **Reload** on it in `chrome://extensions` (the popup shows a
warning if you forget). After changing `helper/media-server.mjs`, restart the helpers:
```powershell
powershell -ExecutionPolicy Bypass -File helper\stop-helpers.ps1
wscript helper\start-helpers.vbs
```

## Project layout

- `extension/` is a Manifest V3 extension written in plain JavaScript modules, with no build step and no dependencies.
- `helper/media-server.mjs` is a Node.js HTTP server with no npm dependencies that runs yt-dlp jobs.
- `helper/setup.ps1` sets up the helpers on Windows.

## Guidelines

- Keep it dependency-free and build-free unless there's a strong reason not to.
- Never weaken the helper security: listen on `127.0.0.1` only, require the secret, reject web
  `Origin`s, and pass arguments to processes as arrays (never through a shell).
- Never break or bypass DRM, and don't add site-specific code that does. Pull requests that do
  will be closed.
- Test your change in a real Chromium browser. In your pull request, say what you tested and on
  which browser.
- Keep the UI working in both light and dark mode.

## Reporting bugs

Please include the browser and version, the extension version (`chrome://extensions`), the
yt-dlp version (Options → Test connection), the page or file URL if you can share it, and what
the popup or progress display said. For a site that stopped working, try **Options → Update
yt-dlp** first: most site breakages are fixed there.
