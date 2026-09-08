# Orbit Media Studio

A Galaxy-inspired media workspace with a responsive website and installable PWA. Includes automatic source recognition, source-derived video qualities, MP4 downloads, MP3 extraction, batch queues, persistent engine history, cancellation, and a region-based watermark editor (FFmpeg delogo or blur).

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

| Variable | Purpose |
| --- | --- |
| `ORBIT_HOST` | Defaults to `127.0.0.1`; use `0.0.0.0` inside your server/container. |
| `ORBIT_PORT` | Defaults to `4318`. |
| `ORBIT_API_KEY` | Required, at least 24 characters, when binding beyond loopback. |
| `ORBIT_ALLOWED_ORIGINS` | Comma-separated exact website origins. Include your deployed Sites URL. |
| `ORBIT_PYTHON` | Optional Python executable override. |
| `ORBIT_FFMPEG` | Optional FFmpeg executable override. |

Example allowed origin for this project: `https://orbit-media-studio.regal-guppy-8422.chatgpt.site`. Never put API keys in source files. Store engine data on a persistent volume. This engine is designed for one personal workspace; a public multiuser product also needs separate user accounts, per-user storage/queues, distributed job processing, quotas, cleanup policies, and operational monitoring.

## Capabilities and limits

- Detects known platform names immediately, then uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) to get available formats. Support varies by site, region, source restrictions, and extractor changes. No promise of “any video”; protected, private, live, or unavailable media can fail. No cookie import or DRM bypass is implemented.
- Video downloads are encoded as MP4 (H.264/AAC). Quality choices reflect source resolutions, with no upscaling. MP3 exports use 192 kbps. “Best available” uses the source extractor's format selection.
- Direct files can omit duration, audio metadata, and available resolutions. The app labels unavailable metadata; audio extraction can fail if the direct source has no audio.
- Two jobs process at once, with a queue limit of 20. Batches accept 10 unique individual video links. Known source filesize is capped at 1 GB, but segmented sources may not declare sizes: deploy with filesystem quotas for a hard storage limit. Each download/conversion stage times out after 20 minutes. Uploads are limited to 512 MB, one hour, and 8K dimensions.
- Watermark editing uses [FFmpeg delogo](https://ffmpeg.org/ffmpeg-filters.html#delogo) to interpolate surrounding pixels, or a blur patch. It does not use generative AI or recover hidden original pixels. One selected rectangle is applied to every frame; moving watermarks and complex backgrounds can leave artifacts. Use media you own or have permission to edit/download.
- Outbound extractor traffic is routed through a DNS-checked proxy that blocks private destinations and pins each connection to a public address. Uploads are local files and FFmpeg accepts only local media protocols. The engine does not accept shell commands from the client. A production service should also enforce egress firewall rules.

## Verification

```powershell
npm run test:engine
node server/smoke.mjs # start the engine first; uses MDN's public CC0 flower sample
npx tsc --noEmit
npm run build
```

The integration check tests a real MP4 download, MP3 conversion, upload, both watermark methods, invalid links, and origin restrictions. Browser UI testing and platform-wide extractor coverage are separate checks. The Docker deployment is supplied but has not been run in this environment. Optional WebMCP tools are feature-detected; a supported browser context is needed to verify registration and interaction.
