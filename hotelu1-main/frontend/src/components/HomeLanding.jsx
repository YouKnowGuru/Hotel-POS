/**
 * HomeLanding — the public home page (route: /)
 *
 * Sections:
 *  1. Hero with real dish photos from live menu + auto-rotating feature card
 *  2. How it Works (#how)
 *  3. Live menu preview (#menu) — top dishes, links to /order
 *  4. Tomza Pack highlight (#tomza)
 *  5. Stats strip
 *  6. Closing order CTA
 *
 * Visual system comes from PublicShell (.pw-* tokens). Static blocks carry
 * `pw-reveal` for scroll-in animation; dynamic grids use staggered CSS.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight, Flame, ShoppingBag, Star, Clock,
  Award, Phone, MapPin, Truck,
  ArrowRight, Sparkles,
} from 'lucide-react';
import PublicShell from './PublicShell';
import { getAPI_URL } from '../utils/api';

const CURRENCY = 'Nu. ';
const MENU_CACHE_KEY = 'hpMenuCache:v3';

/* ── Gradient fallbacks per category ── */
const grad = (cat = '') => {
  const c = cat.toLowerCase();
  if (/chicken|meat|mutton|beef|pork/.test(c)) return ['#ef4444', '#f97316'];
  if (/rice|fried|noodle/.test(c))             return ['#f59e0b', '#d97706'];
  if (/veg|salad|paneer/.test(c))              return ['#22c55e', '#16a34a'];
  if (/drink|juice|beverage|tea|coffee/.test(c)) return ['#3b82f6', '#6366f1'];
  if (/soup|curry/.test(c))                    return ['#f97316', '#ef4444'];
  return ['#8b5cf6', '#6366f1'];
};

const isDrink = (d) =>
  /drink|beverage|juice|tea|coffee|lassi|shake|smoothie|soda|water/i.test(String(d?.category || '')) ||
  /\b(lassi|tea|coffee|juice|water)\b/i.test(String(d?.name || ''));

/* ── Animated counter (reduced-motion aware) ── */
const Counter = ({ target, suffix = '' }) => {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduced) { setVal(target); return undefined; }
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      let start = 0;
      const step = () => {
        start += Math.ceil(target / 40);
        if (start >= target) { setVal(target); return; }
        setVal(start);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
};

/* ── Section heading helper ── */
const Heading = ({ eyebrow, title, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-10 sm:mb-12 pw-reveal">
    <div>
      <p className="pw-eyebrow mb-4">{eyebrow}</p>
      <h2 className="pw-ink font-extrabold tracking-tight leading-[1.08]"
          style={{ fontSize: 'clamp(28px,4vw,44px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
        {title}
      </h2>
    </div>
    {action}
  </div>
);

/* ================================================================== */
const HomeLanding = () => {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);

  /* Load menu from API (cache-first) */
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(MENU_CACHE_KEY));
      if (Array.isArray(cached) && cached.length) { setDishes(cached); setLoading(false); }
    } catch { /* ignore */ }

    const API = getAPI_URL();
    fetch(`${API}/api/menu`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const av = (Array.isArray(data) ? data : []).filter(i => i.isAvailable !== false);
        setDishes(av);
        setLoading(false);
        try { localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(av)); } catch { /* quota */ }
      })
      .catch(() => setLoading(false));
  }, []);

  /* Hero pool — food first, drinks deprioritised */
  const heroPool = useMemo(() => {
    const withPhoto = dishes.filter(d => d.image);
    const food      = withPhoto.filter(d => !isDrink(d));
    return food.length ? food : withPhoto;
  }, [dishes]);

  /* Auto-rotate hero feature card every 4.5 s — pause on hover */
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  useEffect(() => {
    if (heroPool.length < 2) return undefined;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduced) return undefined;
    if (heroPaused) return undefined;
    const t = setInterval(() => setHeroIdx(v => v + 1), 4500);
    return () => clearInterval(t);
  }, [heroPool.length, heroPaused]);

  const heroFeature = heroPool.length ? heroPool[heroIdx % heroPool.length] : null;

  /* Side dishes — stable slice that excludes the current hero feature.
     Derive from heroIdx (a primitive) instead of heroFeature (an object
     reference that changes each render) to avoid needless re-filtering. */
  const heroSides = useMemo(() => {
    if (heroPool.length < 2) return [];
    const idx = heroIdx % heroPool.length;
    const after = heroPool.slice(idx + 1);
    const before = heroPool.slice(0, idx);
    return [...after, ...before].slice(0, 2);
  }, [heroPool, heroIdx]);

  /* Track broken images so we can show a gradient fallback */
  const [brokenImgs, setBrokenImgs] = useState(new Set());
  const markImgBroken = useCallback((id) => {
    setBrokenImgs(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);
  const isImgBroken = useCallback((id) => brokenImgs.has(id), [brokenImgs]);

  /* Decorative ticker names (up to 12 dishes) */
  const dishTicker = useMemo(
    () => dishes.filter(d => d.name).slice(0, 12).map(d => d.name),
    [dishes],
  );

  /* Kitchen hours: 10 AM – 9 PM — re-check every 60 s so the status
     stays correct if the tab stays open across the boundary. */
  const [kitchenOpen, setKitchenOpen] = useState(() => {
    const h = new Date().getHours();
    return h >= 10 && h < 21;
  });
  useEffect(() => {
    const check = () => {
      const h = new Date().getHours();
      setKitchenOpen(h >= 10 && h < 21);
    };
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, []);

  /* Top menu preview (up to 8 items, food first) */
  const previewDishes = useMemo(() => {
    const food   = dishes.filter(d => !isDrink(d) && d.image);
    const drinks = dishes.filter(d => isDrink(d)  && d.image);
    const noImg  = dishes.filter(d => !d.image);
    return [...food, ...drinks, ...noImg].slice(0, 8);
  }, [dishes]);

  const scrollToMenu = (e) => {
    e.preventDefault();
    const el = document.getElementById('menu');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Fallback: navigate to the menu route if the section isn't in the DOM
      window.location.hash = '#menu';
    }
  };

  return (
    <PublicShell active="home">

      {/* ══════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ background: 'var(--pw-bg)' }}>
        {/* soft ambient glows — the dot pattern now lives on the hero stage tile */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background:
            'radial-gradient(720px 380px at 6% -12%,rgba(245,158,11,0.16),transparent 62%),' +
            'radial-gradient(640px 420px at 98% 4%,rgba(234,88,12,0.10),transparent 64%),' +
            'radial-gradient(520px 320px at 50% 118%,rgba(251,191,36,0.10),transparent 70%)',
        }} />

        <div className="pw-container relative px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-6 sm:gap-8 lg:gap-10 xl:gap-16 items-center">

            {/* Left — conversion copy (children stagger in via .hl-col CSS) */}
            <div className="hl-col">
              {  /* Live open-status pill (kitchen hours 10 AM – 9 PM) */}
              <p className="pw-eyebrow mb-6">
                <span className={`hl-dot ${kitchenOpen ? 'is-open' : ''}`} aria-hidden="true" />
                {kitchenOpen ? 'Kitchen open now' : 'Pre-order for tomorrow'}
                <span className="opacity-50" aria-hidden="true">·</span>
                <span className="hidden sm:inline">Delivering across Thimphu</span>
              </p>

              <h1 className="pw-ink mb-5 text-balance"
                  style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.08, fontSize: 'clamp(31px,4.4vw,52px)' }}>
                Bhutanese comfort food —{' '}
                <span className="block" style={{
                  background: 'linear-gradient(90deg,#D9480F,#C2410C)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  made fresh, delivered fast.
                </span>
              </h1>

              <p className="pw-sub leading-relaxed mb-5" style={{ fontSize: 'clamp(15px,1.6vw,18px)', maxWidth: '36rem' }}>
                Fresh momos, rice plates, thukpa and our famous Tomza pack — cooked to order,
                then hot to your door across Thimphu in about 20 minutes, with live tracking
                and easy cash or QR payment.
              </p>

              {/* Social proof — same numbers published in the footer */}
              <div className="flex items-center gap-2.5 mb-7">
                <span className="flex items-center gap-0.5" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={14} fill="#F59E0B" color="#F59E0B" />
                  ))}
                </span>
                <span className="pw-ink text-[13.5px] font-extrabold">4.5</span>
                <span className="pw-muted text-[13px]">· 40+ Google reviews</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <Link to="/order" className="pw-btn-primary w-full sm:w-auto">
                  Order now — ~20 min <ShoppingBag size={18} aria-hidden="true" />
                </Link>
                <a href="#menu" onClick={scrollToMenu} className="pw-btn-ghost-lg w-full sm:w-auto">
                  Browse the menu <ChevronRight size={18} aria-hidden="true" />
                </a>
              </div>

              {/* Funnel micro-steps (teaser for #how) */}
              <ol className="hl-steps mb-9" aria-label="How ordering works">
                {[
                  { n: '1', text: 'Pick your dishes' },
                  { n: '2', text: 'Pay cash or QR' },
                  { n: '3', text: 'Track to your door' },
                ].map(({ n, text }, i) => (
                  <li key={n}>
                    <span className="hl-step-n" aria-hidden="true">{n}</span>
                    {text}
                    {i < 2 && <span className="hl-step-sep" aria-hidden="true">→</span>}
                  </li>
                ))}
              </ol>

              {/* Live stat strip — dishes counter is real data; the rest are
                  service promises already published on this site. */}
              <div className="hl-stats grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 max-w-md">
                <div className="hl-stat">
                  <p className="hl-stat-num"><Counter target={Math.max(dishes.length, 1)} /></p>
                  <p className="hl-stat-label">Dishes on menu</p>
                </div>
                <div className="hl-stat">
                  <p className="hl-stat-num">10<small>% SC</small></p>
                  <p className="hl-stat-label">+ GST, all included</p>
                </div>
                <div className="hl-stat">
                  <p className="hl-stat-num">0<small>Nu.</small></p>
                  <p className="hl-stat-label">Delivery on 3+ packs</p>
                </div>
              </div>
            </div>

            {/* Right — live dish collage on a warm stage tile */}
            <div className="relative pw-reveal" style={{ transitionDelay: '120ms' }}>
              <div className="hl-stage relative rounded-[2rem] p-4 sm:p-6"
                   onMouseEnter={() => setHeroPaused(true)}
                   onMouseLeave={() => setHeroPaused(false)}
                   style={{ background: '#FFF1DD', border: '1px solid rgba(245,158,11,0.32)' }}>
                <span className="hl-stage-dots" aria-hidden="true" />
                <span className="hl-clock absolute -top-3.5 right-5 sm:right-7 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-extrabold"
                      style={{ background: '#FFFFFF', border: '1px solid rgba(245,158,11,0.4)', color: '#C2410C' }}>
                  <Clock size={13} aria-hidden="true" /> Delivering in ~20 min
                </span>

              {/* Loading skeleton — shown while fetching and no cache yet */}
              {loading && heroPool.length === 0 && (
                <div className="flex flex-col gap-3 sm:gap-4 animate-pulse" aria-hidden="true">
                  <div className="rounded-3xl"
                       style={{ height: 'clamp(210px,34vw,320px)', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }} />
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="rounded-2xl"
                         style={{ height: 'clamp(110px,20vw,150px)', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.15)' }} />
                    <div className="rounded-2xl"
                         style={{ height: 'clamp(110px,20vw,150px)', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.15)' }} />
                  </div>
                </div>
              )}

              {heroPool.length === 0 && !loading && (
                <div className="flex items-center justify-center h-64 sm:h-72 rounded-3xl px-6 text-center"
                     style={{ background: 'var(--pw-panel)', border: '1px dashed var(--pw-line)' }}>
                  <p className="pw-muted text-sm">Add dish photos in Menu Management to see them here</p>
                </div>
              )}

              {heroFeature && (
                <div className="grid gap-3 sm:gap-4"
                     aria-live="polite"
                     aria-atomic="true">
                  {/* Main feature card */}
                  <Link
                    key={heroFeature.id}
                    to="/order"
                    className="hl-feature group block rounded-3xl overflow-hidden relative"
                    style={{ border: '1px solid var(--pw-line)', background: 'var(--pw-panel)', animation: 'hlCross 0.6s cubic-bezier(0.22,1,0.36,1) both' }}
                  >
                    {heroFeature.image && !isImgBroken(heroFeature.id)
                      ? <img src={heroFeature.image} alt={heroFeature.name}
                             fetchpriority="high"
                             onError={() => markImgBroken(heroFeature.id)}
                             className="w-full object-cover transition-transform duration-700 group-hover:scale-105"
                             style={{ height: 'clamp(210px,34vw,320px)' }} />
                      : <div style={{ height: 'clamp(210px,34vw,320px)', background: `linear-gradient(135deg,${grad(heroFeature.category)[0]}22,${grad(heroFeature.category)[1]}11)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Flame size={56} style={{ color: grad(heroFeature.category)[0], opacity: 0.5 }} />
                        </div>
                    }
                    <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(4,5,10,0.88) 0%,rgba(4,5,10,0.15) 45%,transparent 70%)' }} />
                    <span className="absolute top-3 left-3 text-[10.5px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(4,5,10,0.7)', border: '1px solid rgba(245,158,11,0.5)', color: '#FBBF24', backdropFilter: 'blur(6px)' }}>
                      {['Chef\'s pick', 'Most loved', 'Fresh daily'][heroIdx % 3]}
                    </span>
                    <span className="absolute bottom-0 inset-x-0 p-4 sm:p-5 flex items-end justify-between gap-3">
                      <span className="block min-w-0">
                        <span className="block text-white font-bold text-lg leading-snug truncate">{heroFeature.name}</span>
                        <span className="block text-[13px] mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>Fresh from the kitchen</span>
                      </span>
                      <span className="shrink-0 px-3 py-1.5 rounded-xl text-sm font-black"
                            style={{ background: 'var(--pw-grad)', color: 'var(--pw-ink-on-accent)' }}>
                        {CURRENCY}{Number(heroFeature.price).toFixed(2)}
                      </span>
                    </span>

                    {/* Rotation indicator dots */}
                    {heroPool.length > 1 && (
                      <span className="absolute bottom-3 right-4 flex items-center gap-1.5 z-10" aria-hidden="true">
                        {heroPool.slice(0, Math.min(heroPool.length, 5)).map((_, i) => (
                          <span key={i} className="hl-rot-dot"
                                style={i === (heroIdx % Math.min(heroPool.length, 5)) ? { background: '#FBBF24', opacity: 1 } : {}} />
                        ))}
                      </span>
                    )}
                  </Link>

                  {/* Side cards */}
                  {heroSides.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      {heroSides.map((d, di) => (
                        <Link key={d.id} to="/order"
                              className="group block rounded-2xl overflow-hidden relative"
                              style={{ border: '1px solid var(--pw-line)', background: 'var(--pw-panel)' }}>
                          {d.image && !isImgBroken(d.id)
                            ? <img src={d.image} alt={d.name} loading="lazy"
                                   onError={() => markImgBroken(d.id)}
                                   className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                   style={{ height: 'clamp(110px,20vw,150px)' }} />
                            : <div style={{ height: 'clamp(110px,20vw,150px)', background: `linear-gradient(135deg,${grad(d.category)[0]}22,${grad(d.category)[1]}11)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Flame size={30} style={{ color: grad(d.category)[0], opacity: 0.5 }} />
                              </div>
                          }
                          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(4,5,10,0.85) 0%,transparent 60%)' }} />
                          <span className="absolute bottom-0 inset-x-0 p-3">
                            <span className="block text-white text-[13.5px] font-semibold leading-snug truncate">{d.name}</span>
                            <span className="block text-[12px] font-bold mt-0.5" style={{ color: '#FBBF24' }}>
                              {CURRENCY}{Number(d.price).toFixed(2)}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* In-tile rating strip */}
              <div className="mt-3 hidden sm:flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl"
                     style={{ background: '#FFFFFF', border: '1px solid var(--pw-line)', boxShadow: '0 12px 28px -18px rgba(63,32,4,0.3)' }}>
                  <span style={{ color: '#FBBF24', display: 'inline-flex' }} aria-hidden="true"><Star size={15} fill="#F59E0B" color="#F59E0B" /></span>
                  <span className="pw-ink text-[13px] font-extrabold">4.5</span>
                  <span className="pw-muted text-[12.5px]">· 40+ reviews</span>
                </div>
                <span className="pw-muted text-[11.5px] font-bold tracking-wider uppercase">
                  {kitchenOpen ? 'Wrapping fresh orders now' : 'Pre-orders open for tomorrow'}
                </span>
              </div>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes hlCross { from { opacity:0; transform:scale(1.03); } to { opacity:1; transform:none; } }
          @keyframes hlUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }

          /* Staggered copy entrance */
          .hl-col > *{ opacity:0; animation:hlUp .55s cubic-bezier(0.22,1,0.36,1) both; }
          .hl-col > *:nth-child(1){ animation-delay:.04s; }
          .hl-col > *:nth-child(2){ animation-delay:.12s; }
          .hl-col > *:nth-child(3){ animation-delay:.20s; }
          .hl-col > *:nth-child(4){ animation-delay:.28s; }

          /* Live stat tiles */
          .hl-stats{ opacity:0; animation:hlUp .55s cubic-bezier(0.22,1,0.36,1) both; animation-delay:.32s; }
          .hl-stat{ padding:12px 14px; border-radius:16px;
            background:var(--pw-panel); border:1px solid var(--pw-line); }
          .hl-stat-num{ font-weight:900; font-size:clamp(20px,2.4vw,26px); color:#C2410C;
            font-variant-numeric:tabular-nums; line-height:1.1; }
          .hl-stat-num small{ font-size:.55em; font-weight:800; color:#D9480F; margin-left:2px; }
          .hl-stat-label{ font-size:10.5px; font-weight:700; color:var(--pw-muted);
            margin-top:3px; letter-spacing:.02em; }

          /* Feature card hover lift + warm glow */
          .hl-feature{ transition:box-shadow .35s var(--pw-ease, ease), transform .35s var(--pw-ease, ease); }
          .hl-feature:hover{ box-shadow:0 30px 70px -28px rgba(245,158,11,0.55); transform:translateY(-4px); }

          /* Rotation indicator dots */
          .hl-rot-dot{ width:6px;height:6px;border-radius:50%;
            background:rgba(255,255,255,0.45);
            transition:background .25s ease,opacity .25s ease,transform .25s ease; }

          /* Live open-status dot */
          .hl-dot{ width:7px;height:7px;border-radius:50%;flex-shrink:0;
            background:#64748B; box-shadow:0 0 0 0 rgba(100,116,139,0.4);
            animation:hlDotPulse 2s ease infinite; }
          .hl-dot.is-open{ background:#34D399; box-shadow:0 0 0 0 rgba(52,211,153,0.5); }
          @keyframes hlDotPulse{
            0%{ box-shadow:0 0 0 0 rgba(52,211,153,0.5); }
            70%{ box-shadow:0 0 0 7px rgba(52,211,153,0); }
            100%{ box-shadow:0 0 0 0 rgba(52,211,153,0); }
          }

          /* Funnel micro-steps */
          .hl-steps{ display:flex;flex-wrap:wrap;align-items:center;gap:6px 4px;
            font-size:12.5px;font-weight:700;color:#5C4B3A;list-style:none;padding:0;margin:0 0 36px; }
          .hl-steps li{ display:inline-flex;align-items:center;gap:7px; }
          .hl-step-n{ width:22px;height:22px;border-radius:50%;flex-shrink:0;
            display:inline-flex;align-items:center;justify-content:center;
            background:rgba(245,158,11,0.13);border:1px solid rgba(245,158,11,0.4);
            color:#C2410C;font-size:11px;font-weight:900; }
          .hl-step-sep{ color:#F59E0B;opacity:.6;margin:0 4px;padding:0 2px; }

          /* Rotating glow ring — removed: hero should feel calm, not gimmicky */

          @media (prefers-reduced-motion: reduce){
            .hl-col > *, .hl-stats{ animation:none !important; opacity:1 !important; transform:none !important; }
            .hl-feature{ transition:none !important; }
            .hl-dot{ animation:none !important; }
          }

          /* Warm stage tile behind the dish collage */
          .hl-stage-dots{position:absolute;inset:0;border-radius:inherit;pointer-events:none;
            background-image:radial-gradient(rgba(63,32,4,0.10) 1px,transparent 1px);
            background-size:22px 22px;
            -webkit-mask-image:radial-gradient(80% 70% at 60% 30%,#000 0%,transparent 100%);
            mask-image:radial-gradient(80% 70% at 60% 30%,#000 0%,transparent 100%);}
          .hl-clock{box-shadow:0 10px 26px -14px rgba(63,32,4,0.5);}

          /* Dark Tomza feature band — keep light text on the dark surface */
          .tz-dark .pw-ink{ color:#F8FAFC; }
          .tz-dark .pw-sub{ color:#C6CFDC; }
          .tz-dark .pw-muted{ color:#A89C8E; }
          .tz-dark .pw-eyebrow{ background:rgba(245,158,11,0.14); border-color:rgba(245,158,11,0.4); color:#FBBF24; }`}</style>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          DISH MARQUEE (decorative ticker — the menu section below is the real thing)
      ════════════════════════════════════════════════════════ */}
      {dishTicker.length > 2 && (
        <div className="pw-fx-marquee"
             style={{ background: 'var(--pw-grad)', color: 'var(--pw-ink-on-accent)' }}
             aria-hidden="true">
          <div className="pw-fx-marquee-inner py-2.5">
            {[0, 1].map(copy => (
              <div key={copy} className="flex items-center shrink-0">
                {dishTicker.map((d, i) => (
                  <span key={i} className="flex items-center text-[13px] font-black uppercase tracking-wider">
                    <span className="px-4">{d}</span>
                    <Flame size={12} className="opacity-70" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════════════ */}
      <section id="how" className="py-16 sm:py-24" style={{ background: 'var(--pw-bg-2)', scrollMarginTop: 96 }}>
        <div className="pw-container px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 pw-reveal">
            <p className="pw-eyebrow mb-4">Simple process</p>
            <h2 className="pw-ink font-extrabold tracking-tight leading-[1.1]"
                style={{ fontSize: 'clamp(28px,4vw,44px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
              Dinner in three easy steps
            </h2>
            <p className="pw-muted mt-4 text-[15px]">No app to install, no account required — just pick, pay and track.</p>
          </div>

          <ol className="grid sm:grid-cols-3 gap-5 sm:gap-6 relative">
            {[
              { step: '01', icon: <ShoppingBag size={24} />, title: 'Browse & pick', desc: 'Explore today’s menu, pick your favourite dishes and drop them in the cart.' },
              { step: '02', icon: <Phone size={24} />,       title: 'Place your order', desc: 'Confirm your address and pay — cash on delivery or online — in seconds.' },
              { step: '03', icon: <Truck size={24} />,       title: 'Fast delivery', desc: 'Our rider brings it hot to your door, typically within ~20 minutes.' },
            ].map(({ step, icon, title, desc }, i) => (
              <li key={step}
                  className="pw-card relative p-6 sm:p-7 text-center pw-reveal"
                  style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 h-7 min-w-[28px] px-2 rounded-full flex items-center justify-center text-[11px] font-black"
                      style={{ background: 'var(--pw-grad)', color: 'var(--pw-ink-on-accent)' }}>
                  {step}
                </span>
                <span className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                      style={{ background: 'rgba(234,88,12,0.09)', border: '1px solid rgba(234,88,12,0.25)', color: '#C2410C' }} aria-hidden="true">
                  {icon}
                </span>
                <h3 className="pw-ink font-bold text-lg mb-2">{title}</h3>
                <p className="pw-muted text-[14px] leading-relaxed">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          LIVE MENU PREVIEW
      ══════════════════════════════════════════════════════════════ */}
      <section id="menu" className="py-16 sm:py-24" style={{ background: 'var(--pw-bg)', scrollMarginTop: 96 }}>
        <div className="pw-container px-4 sm:px-6 lg:px-8">
          <Heading
            eyebrow="Live from our kitchen"
            title="Today’s menu"
            action={
              <Link to="/order" className="pw-btn-primary self-start shrink-0">
                Full menu <ArrowRight size={17} aria-hidden="true" />
              </Link>
            }
          />

          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5" aria-hidden="true">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden animate-pulse"
                     style={{ background: 'var(--pw-panel)', border: '1px solid var(--pw-line)', height: 236 }} />
              ))}
            </div>
          )}

          {!loading && previewDishes.length === 0 && (
            <div className="text-center py-16 pw-card mx-auto max-w-md px-6">
              <Flame size={40} className="mx-auto mb-3" style={{ color: '#F59E0B', opacity: 0.5 }} />
              <p className="pw-muted">Menu loading… come back soon!</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {previewDishes.map((item, i) => (
              <Link
                key={item.id}
                to="/order"
                className="group block rounded-2xl overflow-hidden pw-card pw-fx-tilt pw-fx-sheen pw-reveal min-w-0"
                style={{ transitionDelay: `${Math.min(i, 7) * 55}ms` }}
              >
                <div className="relative h-32 sm:h-36 overflow-hidden">
                  {item.image
                    ? <img src={item.image} alt={item.name} loading="lazy"
                           className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    : <div className="w-full h-full flex items-center justify-center"
                           style={{ background: `linear-gradient(135deg,${grad(item.category)[0]}18,${grad(item.category)[1]}0d)` }}>
                        <Flame size={30} style={{ color: grad(item.category)[0], opacity: 0.5 }} />
                      </div>
                  }
                  {item.category && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(4,5,10,0.75)', color: '#FBBF24', backdropFilter: 'blur(4px)' }}>
                      {item.category}
                    </span>
                  )}
                </div>
                <div className="p-3.5 sm:p-4">
                  <p className="pw-ink font-semibold text-[14px] leading-snug mb-1 line-clamp-1">{item.name}</p>
                  {item.description && (
                    <p className="pw-muted text-[12.5px] leading-relaxed line-clamp-2 mb-2.5">{item.description}</p>
                  )}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <p className="font-black text-[14px] sm:text-[15px] shrink-0 whitespace-nowrap" style={{ color: '#C2410C' }}>
                      {CURRENCY}{Number(item.price).toFixed(2)}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] sm:text-[12px] font-bold pw-muted transition-colors group-hover:opacity-80 shrink-0 whitespace-nowrap">
                      Order <ArrowRight size={13} aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          TOMZA PACK HIGHLIGHT
      ══════════════════════════════════════════════════════════════ */}
      <section id="tomza" className="py-16 sm:py-24" style={{ background: 'var(--pw-bg-2)', scrollMarginTop: 96 }}>
        <div className="pw-container px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl relative overflow-hidden pw-reveal tz-dark"
               style={{ background: 'linear-gradient(135deg,#1B1006 0%,#2A170D 55%,#170D06 100%)', border: '1px solid rgba(245,158,11,0.28)' }}>
            <div aria-hidden="true" style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(500px 300px at 18% 20%,rgba(245,158,11,0.16),transparent 70%)',
            }} />
            <div className="relative p-6 sm:p-10 lg:p-14 grid lg:grid-cols-2 gap-8 xl:gap-12 items-center">
              <div>
                <p className="pw-eyebrow mb-5">
                  <Award size={12} aria-hidden="true" /> Our specialty
                </p>
                <h2 className="pw-ink font-bold leading-[1.15] mb-4"
                    style={{ fontSize: 'clamp(24px,3vw,34px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
                  Tomza — a full Bhutanese meal,
                  <span className="block" style={{ color: '#FBBF24' }}>wrapped in a fresh banana leaf</span>
                </h2>
                <p className="pw-sub leading-relaxed mb-5 max-w-lg">
                  Tomza is a beloved traditional packed lunch — a complete meal wrapped inside a fresh
                  banana leaf, born as a travel meal for farmers and travellers. Each pack balances a bed of
                  Bhutanese red rice with a spicy paa — Sikam Paa (dried pork belly with chili) or Shakam Paa
                  (dried beef with chili) — Ema Datshi or seasonal saag, a boiled egg and fiery ezay on the side.
                </p>
                <p className="pw-muted leading-relaxed mb-6 max-w-lg text-[14px]">
                  It is customary to wash it down with hot, salty butter tea (suja) and a glass of local
                  sour buttermilk (daw) — both served here.
                </p>
                <div className="flex flex-wrap gap-2 mb-8">
                  {['Banana-leaf wrapped', 'Shakam Tomza ~BTN 350', 'Free delivery on 3+ packs'].map(t => (
                    <span key={t} className="pw-chip" style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)', color: '#FBBF24' }}>
                      {t}
                    </span>
                  ))}
                </div>
                <Link to="/order" className="pw-btn-primary">
                  Order Tomza <ChevronRight size={18} aria-hidden="true" />
                </Link>
              </div>

              <div className="grid gap-3 sm:gap-4">
                {[
                  { icon: <Sparkles size={18} />, title: 'What’s inside',       desc: 'Red rice, paa, Ema Datshi, egg & ezay' },
                  { icon: <Star size={18} fill="#F59E0B" color="#F59E0B" />, title: 'BTN 200 – 1,000', desc: 'Shakam Tomza around BTN 350' },
                  { icon: <Truck size={18} />,    title: 'Free delivery on 3+', desc: 'Across Thimphu, wrapped hot' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-4 p-4 sm:p-5 rounded-2xl"
                       style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(245,158,11,0.15)', color: '#FBBF24' }} aria-hidden="true">
                      {icon}
                    </span>
                    <span className="block min-w-0">
                      <span className="block pw-ink font-semibold text-[15px]">{title}</span>
                      <span className="block pw-muted text-[13px] mt-0.5">{desc}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          STATS STRIP
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-16" style={{ background: 'var(--pw-bg)', borderTop: '1px solid var(--pw-line)' }}>
        <div className="pw-container px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 text-center pw-reveal">
            {[
              { val: '4.5★',      label: 'Google rating · 40+ reviews' },
              { val: '200–1,000', label: 'BTN price range' },
              { val: '10 AM–9 PM', label: 'Open every day' },
              { val: '3+',        label: 'Packs = free delivery' },
            ].map(({ val, label }) => (
              <div key={label}>
                <p className="font-black mb-1.5 tabular-nums"
                   style={{
                     fontSize: 'clamp(22px,2.6vw,30px)', lineHeight: 1.1,
                     background: 'linear-gradient(90deg,#D9480F,#C2410C)',
                     WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                   }}>
                  {val}
                </p>
                <p className="pw-muted text-[13px] font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          CLOSING CTA
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20" style={{ background: 'var(--pw-bg-2)' }}>
        <div className="pw-container px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl px-6 py-12 sm:px-12 sm:py-16 text-center pw-reveal"
               style={{ background: 'var(--pw-grad)', color: 'var(--pw-ink-on-accent)' }}>
            <div aria-hidden="true" style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.35,
              background: 'radial-gradient(400px 200px at 20% 0%,rgba(255,255,255,0.5),transparent 70%)',
            }} />
            <div className="relative max-w-2xl mx-auto">
              <p className="text-[11.5px] font-black uppercase tracking-[0.18em] mb-4">Hungry right now?</p>
              <h2 className="font-extrabold leading-[1.06] mb-5"
                  style={{ fontSize: 'clamp(28px,4.4vw,46px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
                Your next favourite meal is 3 taps away.
              </h2>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/order"
                      className="inline-flex items-center justify-center gap-2 min-h-[52px] px-8 rounded-2xl font-extrabold text-[15px] transition-transform hover:-translate-y-0.5"
                      style={{ background: '#120A02', color: '#FFF7EC' }}>
                  Start your order <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <a href={`tel:${'+97577467538'}`}
                   className="inline-flex items-center justify-center gap-2 min-h-[52px] px-8 rounded-2xl font-extrabold text-[15px] transition-transform hover:-translate-y-0.5"
                   style={{ background: 'rgba(255,255,255,0.28)', border: '1.5px solid rgba(27,15,2,0.35)' }}>
                  <Phone size={17} aria-hidden="true" /> Call the kitchen
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

    </PublicShell>
  );
};

export default HomeLanding;
