# Security

## How the helpers are protected

- aria2 (port 6800) and the video helper (port 6801) listen on `127.0.0.1` only. Other devices
  on your network can't reach them.
- Every request must carry a random secret, created by `setup.ps1` and stored in
  `helper/secret.txt`.
- The video helper also rejects any request sent from a web page (a web `Origin`). That means a
  website you visit can't start downloads through it, even if it guesses the port.
- Programs are started with argument lists, never through a shell. URLs must be `http(s)` and
  are passed after `--`.
- Cookie files given to yt-dlp are written only for that one download and deleted when it ends.
  YouTube/Google cookies are never sent.
- "Open" and "Show in folder" only work for files the helpers downloaded themselves.

## Keep your secret private

Anyone who has `helper/secret.txt` and can run programs on your PC can control your downloads.
It is listed in `.gitignore`. Don't commit it or share it.

## Reporting a vulnerability

Please report security problems privately through
[nawodmadhuwantha.com](https://www.nawodmadhuwantha.com) rather than in a public issue.
Include steps to reproduce. You'll get a reply as soon as possible.
