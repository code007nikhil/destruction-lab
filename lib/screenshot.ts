export function normalizeUrl(input: string): string | null {
  let s = input.trim(); if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.toString() : null; } catch { return null; }
}
export async function browse(body: Record<string, unknown>) {
  const res = await fetch('/api/browse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { let m = 'Request failed'; try { m = (await res.json()).error ?? m; } catch {} throw new Error(m); }
  return { blob: await res.blob(), sid: res.headers.get('X-Sid') ?? '', url: decodeURIComponent(res.headers.get('X-Url') ?? '') };
}
export interface Setup { url: string; effect: string; duration: number; intensity: number }
export const encodeSetup = (s: Setup) => btoa(JSON.stringify(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function decodeSetup(t: string, ids: string[]): Setup | null {
  try {
    const o = JSON.parse(atob(t.replace(/-/g, '+').replace(/_/g, '/')));
    const url = normalizeUrl(String(o.url ?? ''));
    if (!url || !ids.includes(o.effect) || !(o.duration >= 1 && o.duration <= 10) || !(o.intensity >= 0.2 && o.intensity <= 1.5)) return null;
    return { url, effect: o.effect, duration: o.duration, intensity: o.intensity };
  } catch { return null; }
}
