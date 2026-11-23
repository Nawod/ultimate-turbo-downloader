# Changelog

All notable changes to Ultimate Turbo Downloader. Versions follow [Semantic Versioning](https://semver.org/).

## 1.4.1 — 2026-11-23

### Fixed
- Downloads whose name comes from the server (`Content-Disposition`, e.g. `…/download?id=…`) were saved as
  `download` with no extension. The extension now waits for the browser to learn the real name and, if it
  can't, asks the server for it before handing the download to aria2.

## 1.4.0 — 2026-11-23

### Changed
- Renamed to **Ultimate Turbo Downloader**. Setup replaces the old Startup shortcut with
  `Ultimate Turbo Downloader.lnk`.
- **Clear finished** is now **Clear list**. It only tidies the list and never touches your files.

### Added
- **Pause / Resume for video downloads** (yt-dlp) in the list and on the progress card. Video
  jobs that were running when the helper stopped come back paused, ready to resume.
- **Remove deletes the file, after asking.** Removing a finished download asks first, then
  moves its file to the Recycle Bin. Cancel deletes the unfinished pieces.
- **Hidden temp folder.** Files and video pieces download into a hidden `.utd-temp` folder
  inside the destination, and only the finished file is moved in (renamed `name (1).ext` if the
  name is taken).
- **Show in folder** for finished file downloads, too.
- A 90-second setup video guide (`docs/setup-guide.mp4`).

### Fixed
- The total speed in the popup now includes video downloads (it showed 0 B/s while a video was
  downloading).

## 1.3.0 — 2026-11-23

### Added
- Download progress shows in the extension's own toolbar popup, under the icon. A separate
  small window is still available as a setting, and is used automatically when the browser can't
  open the popup by itself.
- A "now downloading" card at the top of the popup when you start a download from it.
- Video downloads say which stream they're on (video or audio) for best-quality YouTube.

### Changed
- All sizes and speeds use decimal MB and MB/s (1 MB = 1,000,000 bytes) everywhere, including
  video downloads (which used to show yt-dlp's MiB/s).
- Faster by default: 16 starting connections (they still step down automatically when a server
  refuses), 16 MB TCP receive buffers (2–3× faster on high-latency servers that allow only
  a few connections), adaptive mirror selection, and 16 parallel fragments for HLS/DASH video.

### Fixed
- The progress bar could lag behind the percentage in background windows.
- The video helper's list failed to load after a restart when it held finished jobs.

## 1.2.0

### Added
- IDM-style progress window per download, with Pause / Resume / Cancel / Open / Show in folder.
- A warning in the popup when the extension was updated on disk but not reloaded.

## 1.1.0

### Added
- Video and audio downloads through yt-dlp: a button over videos on pages, a "This page" tab,
  quality choice (Best, 4K, 1080p, 720p, 480p, MP3), and a list of media files the page loaded.
- An image grabber with size and type filters.
- A local video helper (`helper/media-server.mjs`).

## 1.0.0

### Added
- Catches browser downloads and hands them to aria2 for multi-connection downloading,
  with your cookies, referrer and user agent.
- Automatic step-down to fewer connections when a server refuses (HTTP 429 and similar).
- Popup with live progress, pause, resume and cancel.
- Windows setup script, hidden background start, and start at login.
