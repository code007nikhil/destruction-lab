import { NextRequest, NextResponse } from 'next/server';
import type { Browser, Page } from 'playwright';
import { safe } from '@/lib/guard';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Sess { browser: Browser; page: Page; last: number }
const g = globalThis as unknown as { __sess?: Map<string, Sess>; __hits?: Map<string, number[]> };
const sessions = (g.__sess ??= new Map<string, Sess>());
const hits = (g.__hits ??= new Map<string, number[]>());
const KEYS = new Set(['Enter', 'Backspace', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Delete', 'PageDown', 'PageUp', 'Home', 'End']);
const err = (m: string, s: number) => NextResponse.json({ error: m }, { status: s });
const num = (v: unknown) => Math.max(-5000, Math.min(5000, Number(v) || 0));

async function close(id: string) { const s = sessions.get(id); sessions.delete(id); await s?.browser.close().catch(() => {}); }
async function frame(s: Sess, sid: string) {
  await s.page.waitForTimeout(250);
  const buf = await s.page.screenshot({ type: 'jpeg', quality: 82 });
  return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'X-Sid': sid, 'X-Url': encodeURIComponent(s.page.url()) } });
}

export async function POST(req: NextRequest) {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.last > 180_000) void close(id); // idle sessions expire after 3 min
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return err('Bad request.', 400); }
  const action = String(b.action);

  if (action === 'open') {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local';
    const recent = (hits.get(ip) ?? []).filter(t => now - t < 60_000);
    if (recent.length >= 8) return err('Rate limit reached. Try again in a minute.', 429);
    hits.set(ip, [...recent, now]);
    let target: URL;
    try { target = new URL(String(b.url)); } catch { return err('Enter a valid http(s) URL.', 400); }
    if (!(await safe(target))) return err('That address is not allowed (private, internal or unresolvable).', 400);
    if (sessions.size >= 4) return err('All browser slots are busy. Try again shortly.', 503);
    let browser: Browser | undefined;
    try {
      const { chromium } = await import('playwright');
      browser = await chromium.launch();
      const W = Math.min(1920, Math.max(320, Number(b.w) || 1280)), mob = W < 700; // phones get a real mobile viewport
      const ctx = await browser.newContext({ viewport: { width: W, height: Math.min(1400, Math.max(150, Number(b.h) || 800)) }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob, userAgent: mob ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined, acceptDownloads: false });
      const page = await ctx.newPage();
      ctx.on('page', p => { if (p !== page) void p.close(); }); // no popups / new tabs
      // Every request, redirect and subresource is re-validated against the SSRF guard.
      await page.route('**/*', async route => {
        const u = new URL(route.request().url());
        if (u.protocol === 'data:' || u.protocol === 'blob:' || (await safe(u))) await route.continue(); else await route.abort();
      });
      const resp = await page.goto(target.toString(), { timeout: 20_000, waitUntil: 'load' });
      if (!resp) throw new Error('no response');
      if (!(resp.headers()['content-type'] ?? '').includes('html')) { await browser.close(); return err('Only HTML pages can be opened.', 415); }
      const sid = crypto.randomUUID();
      sessions.set(sid, { browser, page, last: now });
      return await frame(sessions.get(sid)!, sid);
    } catch (e) {
      await browser?.close().catch(() => {});
      const m = String((e as Error).message);
      if (/Executable doesn't exist/.test(m)) return err('Playwright browser missing. Run: npx playwright install chromium', 500);
      return err(/Timeout/.test(m) ? 'The site took too long to load.' : 'Could not open this site (it may block automated browsers).', 502);
    }
  }

  const sid = String(b.sid), s = sessions.get(sid);
  if (!s) return err('Session expired. Open the site again.', 410);
  s.last = Date.now();
  try {
    switch (action) {
      case 'click': await s.page.mouse.click(num(b.x), num(b.y)); break;
      case 'wheel': await s.page.mouse.wheel(num(b.dx), num(b.dy)); break;
      case 'type': await s.page.keyboard.type(String(b.text).slice(0, 200)); break;
      case 'key': if (KEYS.has(String(b.key))) await s.page.keyboard.press(String(b.key)); break;
      case 'back': await s.page.goBack({ timeout: 10_000 }).catch(() => null); break;
      case 'close': await close(sid); return NextResponse.json({ ok: true });
      case 'frame': break;
      default: return err('Unknown action.', 400);
    }
    return await frame(s, sid);
  } catch { return err('Action failed or the page closed.', 502); }
}