# Orbit Media Studio

Made by [Chethiya Rathnasekara](https://github.com/damsarachethiyaa-dev).

A Galaxy-inspired media workspace with a responsive website and installable PWA. Includes automatic source recognition, source-derived video qualities, MP4 downloads, MP3 extraction, batch queues, persistent engine history, cancellation, and a region-based watermark editor (FFmpeg delogo or blur).

## Features

- **Smart link detection** — paste a link from YouTube, TikTok, Instagram, X/Twitter, Facebook, Vimeo, Twitch, Reddit, Pinterest, SoundCloud, or Dailymotion and Orbit recognizes the source automatically.
- **Video downloads** as MP4 (H.264/AAC), quality picked from what the source actually offers.
- **Audio extraction** to MP3 (192 kbps).
- **Batch downloads** — queue several links at once.
- **Watermark studio** — select a region on a video you own and blend it out (delogo) or blur it, applied to every frame.
- **Persistent download history**, with cancel-in-progress and re-save support.
- **Installable PWA** with an offline screen, plus optional [WebMCP](https://github.com/webmachinelearning/webmcp) tool registration so compatible browser agents can drive it.
- **Built-in guided tutorials** for every tool.

## Legal & responsible use

This tool is built for downloading media you own or have explicit permission to use — for example, your own uploads, content licensed to you, or material a platform's own tools let you export. Most video platforms' terms of service prohibit third-party downloading of other people's content, so whoever operates a deployment of Orbit is responsible for how it's used and for complying with the terms of the platforms it connects to. yt-dlp's support for a given site can also change or break at any time as platforms update their systems (see Troubleshooting below).

## Project structure

The app is two separate pieces that talk over HTTP: a website (this Next-style app) and a companion "engine" (a plain Node.js server) that does the actual video work. The website never runs yt-dlp/FFmpeg itself.

**Website**

| Path                                       | What it is                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `app/page.tsx`                             | The main page: owns almost all app state, renders the download workspace and every other view.              |
| `components/studio-shell.tsx`              | Sidebar navigation, the platform list + brand icon renderer, the hero graphic, and the feature cards.       |
| `components/media-tools.tsx`               | The tool bodies: quality picker, job queue/history, watermark studio, batch downloader.                     |
| `components/orbit-experience.tsx`          | Background canvas animation, the tutorial dialog, and the Learn page.                                       |
| `components/ui/`                           | Generic [shadcn](https://ui.shadcn.com/) UI primitives (buttons, dialogs, tabs, etc.) — not Orbit-specific. |
| `lib/media.ts`                             | Shared types and the one `api()` function every request to the engine goes through.                         |
| `lib/webmcp.ts`                            | Optional [WebMCP](https://github.com/webmachinelearning/webmcp) tool registration for browser agents.       |
| `app/globals.css`, `app/studio-design.css` | The design system/theme.                                                                                    |

**Engine** (`server/`)

| Path                                           | What it is                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `server/index.mjs`                             | The HTTP API: analyze/download/edit/upload/jobs endpoints, job queue, ffmpeg/yt-dlp invocation.        |
| `server/network.mjs`                           | The egress proxy that blocks yt-dlp/ffmpeg from reaching private/internal addresses (SSRF protection). |
| `server/setup.mjs`                             | One-time setup: creates the local Python venv and installs yt-dlp/ffmpeg.                              |
| `server/dev.mjs`                               | Runs the engine and the website's dev server together (used by `npm run dev:full`).                    |
| `server/smoke.mjs` / `server/network.test.mjs` | Integration/unit checks — see [Verification](#verification).                                           |
| `server/Dockerfile`                            | Container image for hosting the engine on a server/VPS.                                                |

## Run the complete application

Requires Node.js 22.13+ and Python 3.10+.

```powershell
npm install
npm run setup:engine
npm run dev:full
```

Open http://localhost:3000. The companion media engine listens on `127.0.0.1:4318`. Keep it running while processing or downloading. The setup script creates a project-local Python environment and FFmpeg executable; it does not modify system Python packages. In this Codex workspace, the bundled Node 24 executable is at `C:\Users\LEGION\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`; the system Node 20 is too old for the web framework.

On this Windows computer, after initial setup, double-click **Start-Orbit.cmd** to run both the website and engine. It selects the bundled compatible Node automatically and permits the private hosted website to connect to the engine. The launch window stays visible so you can stop the app with Ctrl+C.

Engine files are stored in `.media/`, outside source control. Completed downloads persist across restarts. Delete a history entry to remove its exported file. Active jobs become failed after an engine restart. Uploads expire after 24 hours while the engine runs; uploaded files left by an earlier engine instance are cleaned on startup. Finished jobs are not automatically sent to the browser: click the save icon to select the browser's download location. Preferences are stored only on this browser, and API keys only for this browser session.

## Website and app

The Sites deployment hosts the web interface privately. Cloudflare Workers cannot launch yt-dlp or FFmpeg, so video processing uses the separate companion engine. The hosted website is **not a standalone cloud downloader**. It requires either the local engine and browser permission to reach it, or your own HTTPS-hosted engine. A public HTTPS website may be blocked from reaching a local engine by browser policy; use the local app in that case.

Open Preferences to change the engine URL/key. Install using the browser's Install app / Add to Home Screen command. The offline screen explains how to reconnect; media processing requires a connected engine. This is a PWA, not a native Android/iOS binary.

## Host the processing engine

Use a server/container capable of running FFmpeg, with sufficient disk space and memory. `server/Dockerfile` is included as a deployment starting point. Terminate HTTPS in a reverse proxy. Set:

| Variable                | Purpose                                                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ORBIT_HOST`            | Defaults to `127.0.0.1`; use `0.0.0.0` inside your server/container.                                                                                                                                                                                            |
| `ORBIT_PORT`            | Defaults to `4318`.                                                                                                                                                                                                                                             |
| `ORBIT_API_KEY`         | Required, at least 24 characters, when binding beyond loopback.                                                                                                                                                                                                 |
| `ORBIT_ALLOWED_ORIGINS` | Comma-separated exact website origins. Include your deployed Sites URL.                                                                                                                                                                                         |
| `ORBIT_PYTHON`          | Optional Python executable override.                                                                                                                                                                                                                            |
| `ORBIT_FFMPEG`          | Optional FFmpeg executable override.                                                                                                                                                                                                                            |
| `ORBIT_COOKIES_FILE`    | Optional path to a Netscape-format `cookies.txt` (e.g. exported from your browser) used for sources that require a logged-in session, such as Vimeo. Keep this file private; it is never read or transmitted by anything other than yt-dlp on your own machine. |

Example allowed origin for this project: `https://orbit-media-studio.chethiya-730.chatgpt.site`. Never put API keys in source files. Store engine data on a persistent volume. This engine is designed for one personal workspace; a public multiuser product also needs separate user accounts, per-user storage/queues, distributed job processing, quotas, cleanup policies, and operational monitoring.

### Deploying the engine to a VPS (e.g. Hetzner CX32)

`docker-compose.yml` and `Caddyfile` at the repo root run the engine behind an auto-HTTPS reverse proxy.

1. Point a domain (or subdomain) at your server's IP address (an `A` record).
2. On the server, install Docker, then clone this repo.
3. Copy `.env.example` to `.env` and fill in `ORBIT_DOMAIN` (the domain from step 1), a random 32+ character `ORBIT_API_KEY`, and `ORBIT_ALLOWED_ORIGINS` (your deployed website's exact origin).
4. Run `docker compose up -d --build`. Caddy automatically requests and renews a TLS certificate for `ORBIT_DOMAIN`.
5. In the website's Preferences, set the media engine URL to `https://<ORBIT_DOMAIN>` and paste the same key.

Downloaded files live in the `orbit-media` Docker volume, which survives container restarts and redeploys.

## Capabilities and limits

- Detects known platform names immediately, then uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) to get available formats. Support varies by site, region, source restrictions, and extractor changes. No promise of “any video”; protected, private, live, or unavailable media can fail. Vimeo in particular now requires a logged-in session for most videos; set `ORBIT_COOKIES_FILE` if you need it. No DRM bypass is implemented.
- Video downloads are encoded as MP4 (H.264/AAC). Quality choices reflect source resolutions, with no upscaling. MP3 exports use 192 kbps. “Best available” uses the source extractor's format selection.
- Direct files can omit duration, audio metadata, and available resolutions. The app labels unavailable metadata; audio extraction can fail if the direct source has no audio.
- Two jobs process at once, with a queue limit of 20. Batches accept 10 unique individual video links. Known source filesize is capped at 1 GB, but segmented sources may not declare sizes: deploy with filesystem quotas for a hard storage limit. Each download/conversion stage times out after 20 minutes. Uploads are limited to 512 MB, one hour, and 8K dimensions.
- Watermark editing uses [FFmpeg delogo](https://ffmpeg.org/ffmpeg-filters.html#delogo) to interpolate surrounding pixels, or a blur patch. It does not use generative AI or recover hidden original pixels. One selected rectangle is applied to every frame; moving watermarks and complex backgrounds can leave artifacts. Use media you own or have permission to edit/download.
- Outbound extractor traffic is routed through a DNS-checked proxy that blocks private destinations and pins each connection to a public address. Uploads are local files and FFmpeg accepts only local media protocols. The engine does not accept shell commands from the client. A production service should also enforce egress firewall rules.

## Troubleshooting

- **`npm run build` fails with `SyntaxError: ... does not provide an export named 'glob'`** — your active `node` is older than 22.13. Check with `node --version`; install/switch to Node 22.13+ (see [Run the complete application](#run-the-complete-application)).
- **TikTok links fail with "Unexpected response from webpage request" / an impersonation warning** — the `curl_cffi` browser-impersonation library yt-dlp needs for TikTok isn't installed. It's listed in `server/requirements.txt`; re-run `npm run setup:engine`, or manually: `.venv/Scripts/pip install curl_cffi` (Windows) / `.venv/bin/pip install curl_cffi` (macOS/Linux).
- **Vimeo links fail with "The web client only works when logged-in"** — this is a real, current Vimeo/yt-dlp limitation, not a bug in this app: Vimeo now requires a logged-in session for most videos. Set `ORBIT_COOKIES_FILE` to a `cookies.txt` exported from a browser logged into Vimeo.
- **A previously-working platform suddenly fails** — extractor sites change often. Update yt-dlp: check `pip index versions yt-dlp` inside the venv and bump the version pinned in `server/requirements.txt`.
- **A download sits at "Processing · 90%" for a long time** — that's expected for large/high-resolution sources; the last stretch is the FFmpeg re-encode step, which can take several minutes for 4K video. The UI switches to "Converting your file…" once it reaches that stage.

## Verification

```powershell
npm run test:engine
node server/smoke.mjs # start the engine first; uses MDN's public CC0 flower sample
npx tsc --noEmit
npm run build
```

The integration check tests a real MP4 download, MP3 conversion, upload, both watermark methods, invalid links, and origin restrictions. Browser UI testing and platform-wide extractor coverage are separate checks. The Docker deployment is supplied but has not been run in this environment. Optional WebMCP tools are feature-detected; a supported browser context is needed to verify registration and interaction.
