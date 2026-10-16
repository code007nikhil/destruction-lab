import dns from 'node:dns/promises';
import net from 'node:net';

export function priv(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  if (l.startsWith('::ffff:')) return l.includes('.') ? priv(l.slice(7)) : true;
  return l === '::' || l === '::1' || /^(fc|fd|fe[89ab])/.test(l);
}
export async function safe(u: URL): Promise<boolean> {
  if (!/^https?:$/.test(u.protocol)) return false;
  const h = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return false;
  if (net.isIP(h)) return !priv(h);
  try { const a = await dns.lookup(h, { all: true }); return a.length > 0 && a.every(x => !priv(x.address)); } catch { return false; }
}
