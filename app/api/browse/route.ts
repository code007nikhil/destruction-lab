import { NextRequest, NextResponse } from 'next/server';
import type { Browser } from 'playwright';
import { safe } from '@/lib/guard';

export const runtime = 'nodejs';
export const maxDuration = 60;

const WIDTH_DEFAULT = 1280;
const MAX_H = 3600; // tallest capture in px; raise for longer pages (effects get slower)
const g = globalThis as unknown as { __browser?: Promise<Browser>; __hits?: Map<string, number[]>; __active?: number };
const hits = (g.__hits ??= new Map<string, number[]>());
const err = (m: string, s: number) => NextResponse.json({ error: m }, { status: s });

// One shared Chromium for all captures (fast, low memory); each capture gets its own isolated context.
async function getBrowser(): Promise<Browser> {
  if (g.__browser) { const b = await g.__browser.catch(() => null); if (b?.isConnected()) return b; }
  g.__browser = import('playwright').then(({ chromium }) => chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] }));
  return g.__browser;
}

export async function POST(req: NextRequest) {
  const now = Date.now();
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return err('Bad request.', 400); }
  if (b.action !== 'shot') return err('Unknown action.', 400);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local';
  const recent = (hits.get(ip) ?? []).filter(t => now - t < 60_000);
  if (recent.length >= 8) return err('Rate limit reached. Try again in a minute.', 429);
  hits.set(ip, [...recent, now]);

  const WIDTH = Math.max(360, Math.min(1920, Math.round(Number(b.w)) || WIDTH_DEFAULT)); // phones send a phone-sized width
  let target: URL;
  try { target = new URL(String(b.url)); } catch { return err('Enter a valid http(s) URL.', 400); }
  if (!(await safe(target))) return err('That address is not allowed (private, internal or unresolvable).', 400);
  if ((g.__active ?? 0) >= 3) return err('The server is busy. Try again shortly.', 503);

  g.__active = (g.__active ?? 0) + 1;
  let ctx: Awaited<ReturnType<Browser['newContext']>> | undefined;
  try {
    const browser = await getBrowser();
    ctx = await browser.newContext({ viewport: { width: WIDTH, height: 800 }, acceptDownloads: false, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    ctx.on('page', p => { if (p !== page) void p.close(); }); // no popups / new tabs
    // Every request, redirect and subresource is re-validated against the SSRF guard.
    await page.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.protocol === 'data:' || u.protocol === 'blob:' || (await safe(u))) await route.continue(); else await route.abort();
    });
    const resp = await page.goto(target.toString(), { timeout: 20_000, waitUntil: 'load' });
    if (!resp) throw new Error('no response');
    if (!(resp.headers()['content-type'] ?? '').includes('html')) return err('Only HTML pages can be captured.', 415);
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {});
    // Scroll down once so lazy-loaded images and sections render, then back to the top.
    await page.evaluate(async (max: number) => {
      const h = Math.min(document.documentElement.scrollHeight, max);
      for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); }
      window.scrollTo(0, 0);
    }, MAX_H);
    await page.waitForTimeout(400);
    const full = await page.evaluate(() => document.documentElement.scrollHeight);
    const height = Math.max(400, Math.min(full, MAX_H));
    const buf = await page.screenshot({ type: 'jpeg', quality: 85, fullPage: true, clip: { x: 0, y: 0, width: WIDTH, height } });
    return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'X-Url': encodeURIComponent(page.url()) } });
  } catch (e) {
    const m = String((e as Error).message);
    if (/Executable doesn't exist/.test(m)) return err('Playwright browser missing. Run: npx playwright install chromium', 500);
    return err(/Timeout/.test(m) ? 'The site took too long to load.' : 'Could not capture this site (it may block automated browsers).', 502);
  } finally {
    g.__active = Math.max(0, (g.__active ?? 1) - 1);
    await ctx?.close().catch(() => {});
  }
}