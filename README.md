# DESTRUCTION LAB

**Break the web beautifully.** Open a public website inside the app, browse it, then destroy whatever section is on screen with a cinematic effect. Rebuild it, export a PNG frame, record a video, or share your setup as a link.

> Destruction Lab only manipulates a *picture* of a page. It never modifies, attacks or scans the target website.

## Features

- **Live browsing:** the site runs in a server-side Chromium (Playwright). Frames stream to a canvas; clicks, scrolling, typing, touch-drag and Back are forwarded.
- **10 effects:** Pixel Dissolve, Glass Shatter, Burn Away, Digital Glitch, Black-Hole Vortex, Melt Down, Laser Slice, Shockwave, Matrix Rain, Paper Shredder. All are Canvas 2D, play in reverse for Rebuild, and respond to the Duration and Intensity sliders.
- **Destroy any section:** Destroy freezes the exact view on screen. Rebuild restores it and live browsing resumes.
- **Export:** current frame as PNG, or record a video (WebM, MP4 on Safari) of destroy, rebuild, or both.
- **Share Setup:** a `?setup=` link carrying target URL, effect, duration and intensity (no screenshots or secrets). Values are validated when opened.
- **Responsive:** on every screen size the site fills the window; search and options hide behind icons (search panel and a slide-in sidebar). Phones get a real mobile viewport and touch scrolling.
- Reduced-motion support, toasts, loading/error/empty states.

## Requirements

- Node.js 18.17 or newer
- A machine that can run Chromium (your laptop, a VM or a container)

## Quick start

```bash
npm install
npx playwright install chromium   # one-time download of the browser
npm run dev                       # http://localhost:3000
```

On Linux servers you may also need browser system libraries: `npx playwright install --with-deps chromium`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | TypeScript type check (`tsc --noEmit`) |

## Environment variables

None are required. No API keys, no external services.

## How it works

`POST /api/browse` manages short-lived Playwright sessions (`open`, `frame`, `click`, `wheel`, `type`, `key`, `back`, `close`). Every action returns a JPEG frame. The client draws frames onto a canvas; Destroy copies the current frame and runs an effect on the copy, so the original image is never altered.

## Security

Because this app makes a server fetch pages on a visitor's behalf, treat a public deployment carefully.

- HTTP/HTTPS only; hostnames are DNS-resolved and rejected if **any** address is private, loopback, link-local or otherwise internal (SSRF protection).
- Every browser request, including redirects and subresources, is re-checked against the same guard.
- Popups and new tabs are closed; downloads are disabled; non-HTML main pages are refused.
- Limits: 20 s navigation timeout, 4 concurrent sessions, sessions expire after 3 idle minutes, 8 opens per minute per IP.
- Screenshots and frames are never stored on the server.

Known gaps (please read before deploying publicly):

- The rate limiter and session store are **in memory** (single process). Use Redis or an upstream limiter if you run several instances.
- DNS rebinding between the check and the connection is not fully closed. Run behind an egress firewall or proxy that blocks internal ranges.
- Anything typed goes through your server. The UI warns users not to enter passwords; you should not log request bodies.
- Anyone who can reach your deployment can make it open public websites. Consider authentication or stricter quotas.

Report vulnerabilities privately to the repository owner rather than in a public issue.

## Deployment

Needs a long-running Node host with Chromium, such as a VM or container (for example the official `mcr.microsoft.com/playwright` image). Serverless platforms that cannot run Chromium or keep sessions in memory are not suitable.

## Limitations

- Some sites block automated browsers or show bot checks.
- Hover menus, drag and drop, video and audio do not work through the frame stream.
- The view refreshes about once per second, so it is slower than a normal browser.
- Rotating a phone does not resize an open session; open the site again.
- Effects are Canvas 2D (no WebGL), so very large screens may animate slower.

## Project structure

```
app/
  api/browse/route.ts   remote browser sessions and SSRF guard use
  globals.css           styles (responsive, sidebar, search panel)
  layout.tsx            root layout
  page.tsx              UI, animation engine, export, recording, share
lib/
  effects.ts            the ten effects
  guard.ts              URL and IP safety checks
  screenshot.ts         URL normalizing, browse client, share encoding
```

## Contributing

Issues and pull requests are welcome. Please run `npm run lint` and `npm run build` before submitting.

## License

[MIT](LICENSE)