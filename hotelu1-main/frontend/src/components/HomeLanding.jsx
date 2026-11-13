/**
 * HomeLanding — the public home page (route: /)
 *
 * Sections:
 *  1. Hero with real dish photos from live menu + auto-rotating feature card
 *  2. Today's menu (#menu) — top dishes, links to /order
 *  3. Tomza Pack highlight (#tomza)
 *  4. Stats strip
 *  5. Closing order CTA
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
import MenuImage from './MenuImage';
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
          HERO  —  Premium, clean, animated text
      ══════════════════════════════════════════════════════════════ */}
      <section className="hl-hero relative overflow-hidden" style={{ background: 'var(--pw-bg)' }}>

        {/* Layered ambient background — soft, premium, never noisy */}
        <div className="hl-hero-bg" aria-hidden="true">
          <div className="hl-glow hl-glow-1" />
          <div className="hl-glow hl-glow-2" />
          <div className="hl-glow hl-glow-3" />
          <div className="hl-grain" />
        </div>

        <div className="pw-container relative px-4 sm:px-6 lg:px-8 pt-14 pb-20 sm:pt-20 sm:pb-28 lg:pt-24 lg:pb-32">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 sm:gap-12 lg:gap-16 xl:gap-20 items-center">

            {/* ── Left — premium conversion copy ── */}
            <div className="hl-col">

              {/* Status pill */}
              <div className="hl-pill mb-8" data-open={kitchenOpen}>
                <span className="hl-pill-dot" aria-hidden="true" />
                {kitchenOpen ? 'Kitchen open now' : 'Pre-order for tomorrow'}
                <span className="hl-pill-sep" aria-hidden="true">·</span>
                <span className="hidden sm:inline">Delivering across Thimphu</span>
              </div>

              {/* Headline — outer span = one-shot reveal,
                  inner span = continuous float + gradient shimmer.
                  Splitting them avoids the CSS `animation` shorthand
                  collision that silently cancelled the reveal. */}
              <h1 className="hl-headline pw-ink mb-6"
                  style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.06 }}>
                <span className="hl-word" style={{ animationDelay: '0.10s' }}>
                  <span className="hl-word-float" style={{ animationDelay: '0.0s' }}>Bhutanese</span>
                </span>{' '}
                <span className="hl-word" style={{ animationDelay: '0.20s' }}>
                  <span className="hl-word-float" style={{ animationDelay: '0.3s' }}>comfort</span>
                </span>{' '}
                <span className="hl-word" style={{ animationDelay: '0.30s' }}>
                  <span className="hl-word-float" style={{ animationDelay: '0.6s' }}>food,</span>
                </span>{' '}
                <br className="hidden sm:block" />
                <span className="hl-word" style={{ animationDelay: '0.45s' }}>
                  <span className="hl-word-float hl-grad-text" style={{ animationDelay: '0.9s' }}>made fresh,</span>
                </span>{' '}
                <span className="hl-word" style={{ animationDelay: '0.55s' }}>
                  <span className="hl-word-float hl-grad-text" style={{ animationDelay: '1.2s' }}>delivered fast.</span>
                </span>
              </h1>

              {/* Subhead */}
              <p className="hl-sub pw-sub leading-relaxed mb-8"
                 style={{ fontSize: 'clamp(15px,1.5vw,18px)', maxWidth: '34rem', animationDelay: '0.7s' }}>
                Fresh momos, rice plates, thukpa and our famous Tomza pack — cooked to order,
                then hot to your door across Thimphu in about 20 minutes.
              </p>

              {/* CTAs */}
              <div className="hl-cta-row flex flex-col sm:flex-row gap-3 mb-8" style={{ animationDelay: '0.85s' }}>
                <Link to="/order" className="pw-btn-primary w-full sm:w-auto hl-cta-primary">
                  Order now <ShoppingBag size={17} aria-hidden="true" />
                </Link>
                <a href="#menu" onClick={scrollToMenu} className="pw-btn-ghost-lg w-full sm:w-auto">
                  Browse menu <ChevronRight size={17} aria-hidden="true" />
                </a>
              </div>

              {/* Social proof — minimal, inline */}
              <div className="hl-proof flex items-center gap-3 mb-8" style={{ animationDelay: '1s' }}>
                <span className="flex items-center gap-0.5" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={14} fill="#F59E0B" color="#F59E0B" />
                  ))}
                </span>
                <span className="pw-ink text-[13px] font-bold">4.5</span>
                <span className="pw-muted text-[12.5px]">· 40+ Google reviews</span>
              </div>

              {/* Stat strip — clean, refined */}
              <div className="hl-stats grid grid-cols-3 gap-3 sm:gap-4" style={{ animationDelay: '1.15s' }}>
                <div className="hl-stat">
                  <p className="hl-stat-num"><Counter target={Math.max(dishes.length, 1)} /></p>
                  <p className="hl-stat-label">Dishes</p>
                </div>
                <div className="hl-stat">
                  <p className="hl-stat-num">~20<small>min</small></p>
                  <p className="hl-stat-label">Delivery</p>
                </div>
                <div className="hl-stat">
                  <p className="hl-stat-num">0<small>Nu.</small></p>
                  <p className="hl-stat-label">On 3+ packs</p>
                </div>
              </div>
            </div>

            {/* ── Right — premium dish showcase ── */}
            <div className="relative hl-stage-wrap" style={{ animationDelay: '0.4s' }}>
              <div className="hl-stage relative rounded-[2rem] p-4 sm:p-5"
                   onMouseEnter={() => setHeroPaused(true)}
                   onMouseLeave={() => setHeroPaused(false)}>

                {/* Clock badge */}
                <span className="hl-clock-badge absolute -top-3.5 right-5 sm:right-7 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11.5px] font-extrabold"
                      style={{ background: '#FFFFFF', border: '1px solid rgba(245,158,11,0.35)', color: '#C2410C', boxShadow: '0 8px 24px -10px rgba(63,32,4,0.25)' }}>
                  <Clock size={12} aria-hidden="true" /> ~20 min
                </span>

              {/* Loading skeleton */}
              {loading && heroPool.length === 0 && (
                <div className="flex flex-col gap-3 sm:gap-4 animate-pulse" aria-hidden="true">
                  <div className="rounded-3xl"
                       style={{ height: 'clamp(200px,32vw,300px)', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.15)' }} />
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="rounded-2xl"
                         style={{ height: 'clamp(100px,18vw,140px)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.12)' }} />
                    <div className="rounded-2xl"
                         style={{ height: 'clamp(100px,18vw,140px)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.12)' }} />
                  </div>
                </div>
              )}

              {heroPool.length === 0 && !loading && (
                <div className="flex items-center justify-center h-56 sm:h-64 rounded-3xl px-6 text-center"
                     style={{ background: 'var(--pw-panel)', border: '1px dashed var(--pw-line)' }}>
                  <p className="pw-muted text-sm">Add dish photos in Menu Management to see them here</p>
                </div>
              )}

              {heroFeature && (
                <div className="grid gap-3 sm:gap-4" aria-live="polite" aria-atomic="true">
                  {/* Main feature card */}
                  <Link
                    key={heroFeature.id}
                    to="/order"
                    className="hl-feature group block rounded-3xl overflow-hidden relative"
                    style={{ border: '1px solid var(--pw-line)', background: 'var(--pw-panel)', animation: 'hlCross 0.7s cubic-bezier(0.22,1,0.36,1) both' }}
                  >
                    <MenuImage
                      src={heroFeature.image && !isImgBroken(heroFeature.id) ? heroFeature.image : null}
                      alt={heroFeature.name}
                      ratio={null}
                      priority
                      className="mi-zoom"
                      style={{ height: 'clamp(200px,32vw,300px)' }}
                      tint={`linear-gradient(135deg,${grad(heroFeature.category)[0]}22,${grad(heroFeature.category)[1]}11)`}
                      onError={() => markImgBroken(heroFeature.id)}
                    />
                    <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(4,5,10,0.82) 0%,rgba(4,5,10,0.1) 48%,transparent 70%)' }} />
                    <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(4,5,10,0.65)', border: '1px solid rgba(245,158,11,0.45)', color: '#FBBF24', backdropFilter: 'blur(8px)' }}>
                      {['Chef\'s pick', 'Most loved', 'Fresh daily'][heroIdx % 3]}
                    </span>
                    <span className="absolute bottom-0 inset-x-0 p-4 sm:p-5 flex items-end justify-between gap-3">
                      <span className="block min-w-0">
                        <span className="block text-white font-bold text-base sm:text-lg leading-snug truncate">{heroFeature.name}</span>
                        <span className="block text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Fresh from the kitchen</span>
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
                      {heroSides.map((d) => (
                        <Link key={d.id} to="/order"
                              className="group block rounded-2xl overflow-hidden relative"
                              style={{ border: '1px solid var(--pw-line)', background: 'var(--pw-panel)' }}>
                          <MenuImage
                            src={d.image && !isImgBroken(d.id) ? d.image : null}
                            alt={d.name}
                            ratio={null}
                            className="mi-zoom"
                            style={{ height: 'clamp(100px,18vw,140px)' }}
                            tint={`linear-gradient(135deg,${grad(d.category)[0]}22,${grad(d.category)[1]}11)`}
                            onError={() => markImgBroken(d.id)}
                          />
                          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(4,5,10,0.8) 0%,transparent 55%)' }} />
                          <span className="absolute bottom-0 inset-x-0 p-2.5 sm:p-3">
                            <span className="block text-white text-[12.5px] font-semibold leading-snug truncate">{d.name}</span>
                            <span className="block text-[11px] font-bold mt-0.5" style={{ color: '#FBBF24' }}>
                              {CURRENCY}{Number(d.price).toFixed(2)}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>

        <style>{`
          /* ── Premium hero background ── */
          .hl-hero-bg{ position:absolute; inset:0; pointer-events:none; overflow:hidden; }
          .hl-glow{ position:absolute; border-radius:50%; filter:blur(80px); }
          .hl-glow-1{
            width:600px; height:400px; top:-120px; left:-80px;
            background:radial-gradient(circle,rgba(245,158,11,0.18) 0%,transparent 70%);
            animation:hlFloat 12s ease-in-out infinite;
          }
          .hl-glow-2{
            width:500px; height:500px; top:10%; right:-100px;
            background:radial-gradient(circle,rgba(234,88,12,0.12) 0%,transparent 70%);
            animation:hlFloat 14s ease-in-out infinite reverse;
          }
          .hl-glow-3{
            width:450px; height:300px; bottom:-80px; left:30%;
            background:radial-gradient(circle,rgba(251,191,36,0.10) 0%,transparent 70%);
            animation:hlFloat 16s ease-in-out infinite;
          }
          .hl-grain{
            position:absolute; inset:0;
            background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
            opacity:0.5;
          }
          @keyframes hlFloat{
            0%,100%{ transform:translate(0,0) scale(1); }
            33%{ transform:translate(20px,-15px) scale(1.05); }
            66%{ transform:translate(-15px,10px) scale(0.97); }
          }

          /* ── Status pill ── */
          .hl-pill{
            display:inline-flex; align-items:center; gap:8px;
            padding:7px 16px; border-radius:999px;
            font-size:12.5px; font-weight:700; letter-spacing:0.01em;
            background:var(--pw-panel); border:1px solid var(--pw-line);
            box-shadow:0 4px 14px -6px rgba(63,32,4,0.12);
            opacity:0; animation:hlFadeUp .6s var(--pw-ease, cubic-bezier(0.22,1,0.36,1)) forwards;
          }
          .hl-pill-dot{
            width:7px; height:7px; border-radius:50%; flex-shrink:0;
            background:#64748B;
            animation:hlDotPulse 2.5s ease infinite;
          }
          .hl-pill[data-open="true"] .hl-pill-dot{
            background:#34D399;
            box-shadow:0 0 0 0 rgba(52,211,153,0.5);
          }
          .hl-pill-sep{ opacity:0.4; }
          @keyframes hlDotPulse{
            0%{ box-shadow:0 0 0 0 rgba(52,211,153,0.5); }
            70%{ box-shadow:0 0 0 6px rgba(52,211,153,0); }
            100%{ box-shadow:0 0 0 0 rgba(52,211,153,0); }
          }

          /* ── Headline: one-shot reveal (outer) ── */
          .hl-word{
            display:inline-block;
            opacity:0;
            animation:hlWordIn .7s var(--pw-ease, cubic-bezier(0.22,1,0.36,1)) both;
          }
          @keyframes hlWordIn{
            0%{ opacity:0; transform:translateY(28px); }
            100%{ opacity:1; transform:translateY(0); }
          }

          /* ── Headline: CONTINUOUS gentle float (inner) ──
             This is the motion that keeps the text alive after the
             entrance reveal has finished. */
          .hl-word-float{
            display:inline-block;
            animation:hlBob 5s ease-in-out infinite;
            will-change:transform;
          }
          @keyframes hlBob{
            0%,100%{ transform:translateY(0); }
            50%{ transform:translateY(-4px); }
          }

          /* ── Gradient text: visible gold light-sweep ──
             No animation declaration here — it is added by the combined selectors
             below so it can never cancel the float or reveal. */
          .hl-grad-text{
            background:linear-gradient(100deg,
              #C2410C 0%, #EA580C 26%, #FBBF24 44%,
              #FFE7A8 50%, #FBBF24 56%, #EA580C 74%, #C2410C 100%);
            background-size:220% 100%;
            background-position:0% 50%;
            -webkit-background-clip:text;
            background-clip:text;
            -webkit-text-fill-color:transparent;
            color:transparent;
          }
          /* Gradient words run BOTH the float and the shimmer */
          .hl-word-float.hl-grad-text{
            animation:
              hlBob 5s ease-in-out infinite,
              hlShimmer 3s linear infinite;
          }
          @keyframes hlShimmer{
            0%{ background-position:0% 50%; }
            100%{ background-position:100% 50%; }
          }
          .hl-headline{
            font-size:clamp(32px,5vw,56px);
          }

          /* ── Subhead, CTA row, proof — staggered fade-up ── */
          .hl-sub, .hl-cta-row, .hl-proof, .hl-stats{
            opacity:0;
            animation:hlFadeUp .7s var(--pw-ease, cubic-bezier(0.22,1,0.36,1)) forwards;
          }
          @keyframes hlFadeUp{
            0%{ opacity:0; transform:translateY(20px); }
            100%{ opacity:1; transform:translateY(0); }
          }

          /* ── CTA primary — premium lift ── */
          .hl-cta-primary{
            transition:transform .3s var(--pw-ease, ease), box-shadow .3s var(--pw-ease, ease);
          }
          .hl-cta-primary:hover{
            transform:translateY(-2px);
            box-shadow:0 14px 32px -10px rgba(234,88,12,0.5);
          }

          /* ── Stat tiles — clean, minimal ── */
          .hl-stat{
            padding:14px 16px; border-radius:14px;
            background:var(--pw-panel); border:1px solid var(--pw-line);
            transition:transform .3s var(--pw-ease, ease), box-shadow .3s var(--pw-ease, ease);
          }
          .hl-stat:hover{
            transform:translateY(-2px);
            box-shadow:0 8px 20px -8px rgba(63,32,4,0.12);
          }
          .hl-stat-num{
            font-weight:900; font-size:clamp(18px,2.2vw,24px);
            color:#C2410C; font-variant-numeric:tabular-nums; line-height:1.1;
          }
          .hl-stat-num small{
            font-size:.5em; font-weight:800; color:#D9480F; margin-left:2px;
          }
          .hl-stat-label{
            font-size:10px; font-weight:700; color:var(--pw-muted);
            margin-top:3px; letter-spacing:0.03em; text-transform:uppercase;
          }

          /* ── Stage wrap fade-in ── */
          .hl-stage-wrap{
            opacity:0;
            animation:hlStageIn .8s var(--pw-ease, cubic-bezier(0.22,1,0.36,1)) forwards;
          }
          @keyframes hlStageIn{
            0%{ opacity:0; transform:translateY(24px) scale(0.98); }
            100%{ opacity:1; transform:translateY(0) scale(1); }
          }

          /* ── Stage tile — premium glass surface ── */
          .hl-stage{
            background:rgba(255,241,221,0.6);
            border:1px solid rgba(245,158,11,0.25);
            backdrop-filter:blur(12px);
            box-shadow:0 24px 60px -20px rgba(63,32,4,0.15);
          }

          /* ── Feature card hover ── */
          .hl-feature{
            transition:box-shadow .4s var(--pw-ease, ease), transform .4s var(--pw-ease, ease);
          }
          .hl-feature:hover{
            box-shadow:0 28px 64px -24px rgba(245,158,11,0.5);
            transform:translateY(-3px);
          }

          /* ── Rotation dots ── */
          .hl-rot-dot{
            width:5px; height:5px; border-radius:50%;
            background:rgba(255,255,255,0.4);
            transition:background .25s ease, opacity .25s ease;
          }

          /* ── Cross-fade animation for hero rotation ── */
          @keyframes hlCross{
            from{ opacity:0; transform:scale(1.03); }
            to{ opacity:1; transform:none; }
          }

          /* ── Dark Tomza feature band ── */
          .tz-dark .pw-ink{ color:#F8FAFC; }
          .tz-dark .pw-sub{ color:#C6CFDC; }
          .tz-dark .pw-muted{ color:#A89C8E; }
          .tz-dark .pw-eyebrow{ background:rgba(245,158,11,0.14); border-color:rgba(245,158,11,0.4); color:#FBBF24; }

          /* ── Reduced motion ──
             Keep every word visible with a static (still attractive)
             gradient; disable all looping motion. */
          @media (prefers-reduced-motion: reduce){
            .hl-word, .hl-sub, .hl-cta-row, .hl-proof, .hl-stats,
            .hl-stage-wrap, .hl-pill{
              animation:none !important; opacity:1 !important; transform:none !important;
            }
            .hl-word-float{
              animation:none !important; transform:none !important;
            }
            .hl-grad-text{
              animation:none !important;
              background-position:50% 50% !important;
            }
            .hl-glow-1, .hl-glow-2, .hl-glow-3{ animation:none !important; }
            .hl-pill-dot{ animation:none !important; }
            .hl-feature{ transition:none !important; }
          }
        `}</style>
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

      {/* ══════════════════════════════════════════════════════════════
          TODAY'S MENU  (replaces former "Dinner in three easy steps")
      ══════════════════════════════════════════════════════════════ */}
      <section id="menu" className="py-16 sm:py-24" style={{ background: 'var(--pw-bg-2)', scrollMarginTop: 96 }}>
        <div className="pw-container px-4 sm:px-6 lg:px-8">
          <Heading
            eyebrow="Live from our kitchen"
            title="Today's menu"
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
                     style={{ background: 'var(--pw-panel)', border: '1px solid var(--pw-line)', aspectRatio: '4 / 3' }} />
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
                <MenuImage
                  src={item.image}
                  alt={item.name}
                  ratio="4 / 3"
                  className="mi-zoom"
                  tint={`linear-gradient(135deg,${grad(item.category)[0]}18,${grad(item.category)[1]}0d)`}
                >
                  {item.category && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(4,5,10,0.75)', color: '#FBBF24', backdropFilter: 'blur(4px)' }}>
                      {item.category}
                    </span>
                  )}
                </MenuImage>
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
