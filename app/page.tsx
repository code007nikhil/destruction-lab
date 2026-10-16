'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Zap, Download, Share2, Play, RotateCcw, Undo2, Flame, Grid3x3, Diamond, Orbit, Crosshair, Skull, ArrowLeft, Menu, X, Search, Droplets, Scissors, Bomb, Binary, Trash2, Video } from 'lucide-react';
import { EFFECTS, EffectId } from '@/lib/effects';
import { browse, decodeSetup, encodeSetup, normalizeUrl } from '@/lib/screenshot';

const ICONS: Record<EffectId, React.ReactNode> = { pixel: <Grid3x3 size={20} />, glass: <Diamond size={20} />, burn: <Flame size={20} />, glitch: <Zap size={20} />, hole: <Orbit size={20} />, melt: <Droplets size={20} />, slice: <Scissors size={20} />, blast: <Bomb size={20} />, matrix: <Binary size={20} />, shred: <Trash2 size={20} /> };
const EXAMPLES = ['example.com', 'wikipedia.org', 'news.ycombinator.com'];
const KEYS = ['Enter', 'Backspace', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Delete', 'PageDown', 'PageUp', 'Home', 'End'];

export default function Home() {
  const [url, setUrl] = useState(''); const [shownUrl, setShownUrl] = useState('');
  const [effect, setEffect] = useState<EffectId>('pixel');
  const [duration, setDuration] = useState(3); const [intensity, setIntensity] = useState(1);
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [live, setLive] = useState(false); const [dim, setDim] = useState('');
  const [rec, setRec] = useState(false); const [recMode, setRecMode] = useState<'destroy' | 'rebuild' | 'both'>('both'); const [menu, setMenu] = useState(false); const [search, setSearch] = useState(false); const inp = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [prog, setProg] = useState(0);
  const [toast, setToast] = useState(''); const [status, setStatus] = useState('> idle. open a site to begin.');
  const cv = useRef<HTMLCanvasElement>(null); const stage = useRef<HTMLDivElement>(null);
  const src = useRef<HTMLCanvasElement | null>(null); const frozen = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef(0); const p = useRef(0); const sid = useRef('');
  const queue = useRef<Promise<unknown>>(Promise.resolve()); const pending = useRef(0);
  const vw = useRef(1280); const ty = useRef(0); const wacc = useRef(0); const wt = useRef(0);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  const paint = useCallback(() => {
    const c = cv.current, s = p.current === 0 ? src.current : frozen.current; if (!c || !s) return;
    const ctx = c.getContext('2d')!;
    if (p.current === 0) { ctx.globalAlpha = 1; ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(s, 0, 0); }
    else EFFECTS.find(e => e.id === effect)!.draw({ ctx, src: s, w: c.width, h: c.height }, p.current, intensity);
  }, [effect, intensity]);
  const paintRef = useRef(paint); paintRef.current = paint;

  const setFrame = useCallback(async (blob: Blob) => {
    if (!blob.size) return;
    const bmp = await createImageBitmap(blob);
    const s = src.current ?? (src.current = document.createElement('canvas'));
    if (s.width !== bmp.width || s.height !== bmp.height) { s.width = bmp.width; s.height = bmp.height; }
    s.getContext('2d')!.drawImage(bmp, 0, 0); bmp.close();
    const c = cv.current; if (c && (c.width !== s.width || c.height !== s.height)) { c.width = s.width; c.height = s.height; }
    setDim(`${s.width}×${s.height}`);
    if (p.current === 0) paintRef.current();
  }, []);

  // All remote-browser actions run one at a time, in order.
  const act = useCallback((body: Record<string, unknown>) => {
    pending.current++;
    const job = queue.current.then(async () => {
      const r = await browse({ ...body, sid: sid.current });
      if (r.url) setShownUrl(r.url);
      if (p.current === 0) await setFrame(r.blob);
    }).finally(() => { pending.current--; });
    queue.current = job.catch(() => {});
    return job;
  }, [setFrame]);
  const fail = (e: unknown) => { const m = (e as Error).message; setError(m); if (/expired/i.test(m)) { setLive(false); sid.current = ''; } };

  const run = useCallback((to: number, done?: () => void) => {
    cancelAnimationFrame(raf.current);
    const from = p.current; if (from === to || !src.current) return;
    if (from === 0) { // freeze the exact section currently on screen
      const f = document.createElement('canvas'); f.width = src.current.width; f.height = src.current.height;
      f.getContext('2d')!.drawImage(src.current, 0, 0); frozen.current = f;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 1 : Math.abs(to - from) * duration * 1000, t0 = performance.now();
    setBusy(true); setStatus(to > from ? `> ${effect}: destroying…` : `> ${effect}: rebuilding…`);
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / dur), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      p.current = from + (to - from) * e; paint(); setProg(p.current);
      if (u < 1) raf.current = requestAnimationFrame(step);
      else { p.current = to; paint(); setProg(to); setBusy(false); setStatus(to ? '> destroyed. rebuild to keep browsing.' : '> restored. site is live again.'); done?.(); }
    };
    raf.current = requestAnimationFrame(step);
  }, [duration, effect, paint]);

  const reset = useCallback(() => { cancelAnimationFrame(raf.current); p.current = 0; setProg(0); setBusy(false); paint(); setStatus('> reset. site is live.'); }, [paint]);

  const open = useCallback(async (raw: string) => {
    setSearch(false);
    const n = normalizeUrl(raw); if (!n) { setError('Enter a valid public website address, e.g. example.com'); setSearch(true); return; }
    cancelAnimationFrame(raf.current); p.current = 0; setProg(0); setBusy(false); setLive(false);
    if (sid.current) { void browse({ action: 'close', sid: sid.current }).catch(() => {}); sid.current = ''; }
    setError(''); setLoading(true); setStatus(`> opening ${new URL(n).hostname}…`);
    try {
      const st = stage.current;
      const w = window.innerWidth < 700 ? 400 : Math.min(1920, Math.max(1024, Math.round(st?.clientWidth ?? 1280))); // phones get a phone viewport; big screens match the box vw.current = w;
      const r = await browse({ action: 'open', url: n, w, h: st ? Math.round(w * st.clientHeight / st.clientWidth) : 800 });
      sid.current = r.sid; setUrl(n); setShownUrl(r.url || n); await setFrame(r.blob); setLive(true);
      setStatus('> site is live. browse it, then hit Destroy anytime.');
    } catch (e) { setError((e as Error).message); setStatus('> open failed.'); }
    setLoading(false);
  }, [setFrame]);

  // Refresh the live view while the page is idle (animations, loading content).
  useEffect(() => {
    if (!live || busy || prog !== 0) return;
    const t = window.setInterval(() => { if (pending.current === 0) act({ action: 'frame' }).catch(fail); }, 1000);
    return () => clearInterval(t);
  }, [live, busy, prog, act]);
  useEffect(() => { paint(); }, [paint]);
  useEffect(() => {
    const end = () => { if (sid.current) fetch('/api/browse', { method: 'POST', body: JSON.stringify({ action: 'close', sid: sid.current }), keepalive: true }); };
    window.addEventListener('beforeunload', end);
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener('beforeunload', end); end(); };
  }, []);

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('setup'); if (!t) return;
    const s = decodeSetup(t, EFFECTS.map(e => e.id)); if (!s) { say('Shared setup link is invalid.'); return; }
    setUrl(s.url); setEffect(s.effect as EffectId); setDuration(s.duration); setIntensity(s.intensity); say('Setup restored. Open the site to run it.');
  }, []);

  const lock = busy || rec;
  const can = live && !lock && prog === 0;
  const record = () => { // records the full destruction as a video of the real canvas output
    const c = cv.current; if (!c || !src.current) return;
    const mime = typeof MediaRecorder === 'undefined' ? undefined : ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m));
    if (!mime) { say('Video recording is not supported in this browser.'); return; }
    cancelAnimationFrame(raf.current);
    if (recMode === 'rebuild' && p.current === 0) { // start from a destroyed frame so the video shows the rebuild
      const f = document.createElement('canvas'); f.width = src.current.width; f.height = src.current.height;
      f.getContext('2d')!.drawImage(src.current, 0, 0); frozen.current = f; p.current = 1;
    } else if (recMode !== 'rebuild') p.current = 0;
    setProg(p.current); paint();
    const chunks: Blob[] = [], rc = new MediaRecorder(c.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    rc.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rc.onstop = () => {
      setRec(false); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(chunks, { type: mime.split(';')[0] }));
      a.download = `destruction-lab-${effect}.${mime.includes('mp4') ? 'mp4' : 'webm'}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); say('Video exported.');
    };
    setRec(true); setMenu(false); setStatus('> recording video…'); rc.start();
    const stop = () => setTimeout(() => rc.stop(), 600);
    setTimeout(() => (recMode === 'rebuild' ? run(0, stop) : run(1, recMode === 'both' ? () => setTimeout(() => run(0, stop), 500) : stop)), 400);
  };
  const pt = (e: { clientX: number; clientY: number }) => {
    const c = cv.current!, b = c.getBoundingClientRect(), s = Math.min(b.width / c.width, b.height / c.height);
    const k = s * (c.width / vw.current); // screen px per remote CSS px
    return { x: (e.clientX - b.left - (b.width - c.width * s) / 2) / k, y: (e.clientY - b.top - (b.height - c.height * s) / 2) / k };
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!can || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length === 1) { e.preventDefault(); act({ action: 'type', text: e.key }).catch(fail); }
    else if (KEYS.includes(e.key)) { e.preventDefault(); act({ action: 'key', key: e.key }).catch(fail); }
  };
  const queueWheel = (dy: number) => {
    wacc.current += dy; window.clearTimeout(wt.current);
    wt.current = window.setTimeout(() => { const d = wacc.current; wacc.current = 0; act({ action: 'wheel', dx: 0, dy: d }).catch(fail); }, 50);
  };
  const onWheel = (e: React.WheelEvent) => { if (can) queueWheel(e.deltaY); };
  const onTouchMove = (e: React.TouchEvent) => { // drag to scroll the remote page
    if (!can) return; const y = e.touches[0].clientY;
    queueWheel((ty.current - y) * (vw.current / cv.current!.getBoundingClientRect().width)); ty.current = y;
  };
  const exportFrame = () => cv.current?.toBlob(b => {
    if (!b) { say('Export failed.'); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `destruction-lab-${effect}-${Math.round(prog * 100)}.png`; a.click(); URL.revokeObjectURL(a.href); say('Exported current frame as PNG.');
  }, 'image/png');
  const share = async () => {
    const n = normalizeUrl(url); if (!n) { say('Enter a target URL first.'); return; }
    const link = `${location.origin}/?setup=${encodeSetup({ url: n, effect, duration, intensity })}`;
    try { await navigator.clipboard.writeText(link); say('Share link copied.'); } catch { prompt('Copy this link', link); }
  };

  return (
    <div className="wrap">
      <nav>
        <div className="logo"><i><Skull size={20} /></i><div>DESTRUCTION LAB<div className="mono" style={{ letterSpacing: 0 }}>live site destroyer</div></div></div>
        <span className="mono"><span className="dot" />ready</span>
        <div className="navbtns">
          <button className="menu-btn" onClick={() => { setSearch(s => !s); setMenu(false); setTimeout(() => inp.current?.focus(), 60); }} aria-label="Search site"><Search size={18} /></button>
          <button className="menu-btn" onClick={() => { setMenu(m => !m); setSearch(false); }} aria-label="Toggle options">{menu ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
      </nav>
      <header className="hero"><h1>BREAK THE WEB BEAUTIFULLY.</h1><p>Open a site, browse it, then destroy whatever section is on screen.</p></header>
      <form className={`row target${search ? ' open' : ''}`} onSubmit={e => { e.preventDefault(); open(url); }}>
        <input ref={inp} type="text" aria-label="Website URL" placeholder="example.com" value={url} onChange={e => setUrl(e.target.value)} />
        <button className="pri" disabled={loading || lock}><Crosshair size={16} />{loading ? 'Opening…' : 'Open site'}</button>
      </form>
      <div className="row mono" style={{ marginTop: 8 }}>Try: {EXAMPLES.map(x => <button key={x} type="button" onClick={() => { setUrl(x); open(x); }} disabled={loading || lock} style={{ padding: '2px 8px' }}>{x}</button>)} · Don’t enter passwords: the page runs in a server-side browser.</div>
      {error && <p className="err" role="alert">{error}</p>}

      <div className="lab">
        <section className="preview">
          <div className="frame">
            <div className="bar"><b /><b /><b />
              <button disabled={!can} onClick={() => act({ action: 'back' }).catch(fail)} aria-label="Back" style={{ padding: '2px 6px' }}><ArrowLeft size={14} /></button>
              <span className="addr mono">{shownUrl || 'about:blank'}</span></div>
            <div className="stage" ref={stage}>
              <canvas ref={cv} tabIndex={0} aria-label="Live website" style={{ visibility: live ? 'visible' : 'hidden', cursor: can ? 'pointer' : 'default' }}
                onClick={e => { if (can) { cv.current?.focus(); act({ action: 'click', ...pt(e) }).catch(fail); } }} onWheel={onWheel} onKeyDown={onKey} onTouchStart={e => { ty.current = e.touches[0].clientY; }} onTouchMove={onTouchMove} />
              {!live && !loading && <div className="empty">{error ? 'Could not open the site. Check the address and try again.' : 'No site yet. Enter a URL and open it.'}</div>}
              {loading && <><div className="empty">Opening site…</div><div className="scan" /></>}
            </div>
          </div>
          <button className="fab pri" disabled={!live || lock} onClick={() => run(prog === 0 ? 1 : 0)}>{prog === 0 ? <><Flame size={16} />Destroy</> : <><Undo2 size={16} />Rebuild</>}</button>
          <div className="prog"><div style={{ width: `${prog * 100}%` }} /></div>
          <p className="mono" style={{ margin: '6px 0 0' }}>{status} {dim && `[${dim}] [${Math.round(prog * 100)}%]`}</p>
        </section>

        {menu && <div className="scrim" onClick={() => setMenu(false)} />}
        <aside className={`side panel${menu ? ' open' : ''}`}>
          <div className="fx">
            {EFFECTS.map(f => (
              <button key={f.id} className={effect === f.id ? 'on' : ''} disabled={lock} onClick={() => { if (prog > 0) reset(); setEffect(f.id); }}>
                {ICONS[f.id]}<span><b>{f.name}</b><br /><span className="mono">{f.blurb}</span></span>
              </button>
            ))}
          </div>
          <div className="sliders">
            <label className="mono">Duration: {duration}s<input type="range" min={1} max={10} step={0.5} value={duration} disabled={lock} onChange={e => setDuration(+e.target.value)} /></label>
            <label className="mono">Intensity: {intensity.toFixed(1)}<input type="range" min={0.2} max={1.5} step={0.1} value={intensity} disabled={lock} onChange={e => setIntensity(+e.target.value)} /></label>
          </div>
          <div className="actions">
            <button className="pri wide" disabled={!live || lock || prog === 1} onClick={() => { setMenu(false); run(1); }}><Flame size={16} />Destroy this view</button>
            <button disabled={!live || lock || prog === 0} onClick={() => run(0)}><Undo2 size={16} />Rebuild</button>
            <button disabled={!live || lock} onClick={() => { setMenu(false); p.current = 0; run(1); }}><Play size={16} />Replay</button>
            <button disabled={!live} onClick={reset}><RotateCcw size={16} />Reset</button>
            <button disabled={!live} onClick={exportFrame} title="Downloads the current frame as a PNG"><Download size={16} />Export PNG</button>
            <label className="mono wide">Video records<select value={recMode} disabled={lock} onChange={e => setRecMode(e.target.value as typeof recMode)}><option value="destroy">Destroy only</option><option value="rebuild">Rebuild only</option><option value="both">Destroy, then rebuild</option></select></label>
            <button className="wide" disabled={!live || lock} onClick={record} title="Records the destruction as a video (WebM, or MP4 on Safari)"><Video size={16} />Record video</button>
            <button className="wide" onClick={share} title="Copies a link with target, effect, duration and intensity"><Share2 size={16} />Share setup</button>
          </div>
        </aside>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}