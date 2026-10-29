/**
 * PublicShell — shared wrapper for every public-facing page
 * (home, /order, /about, /privacy, /terms).
 *
 * Design system — "Ember" dark theme (all public pages read from .pw-root tokens):
 *  - Scroll-away announcement strip + sticky in-flow header (no fixed-overlay math)
 *  - Glass header that solidifies on scroll, active-link indicator
 *  - Full-screen animated mobile drawer (Escape + backdrop dismiss, scroll lock)
 *  - Scroll-reveal engine: children add `pw-reveal`, shell adds `pw-in`
 *    (reduced-motion safe — content is never left hidden)
 *  - Responsive footer: 1 → 2 → 4 columns, contact, hours, socials
 *  - Hash-link scrolling (React Router pushState doesn't trigger native anchors)
 */
import React, { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu, X, Utensils, Phone, MapPin,
  ChevronRight, Star, Clock, ArrowRight,
} from 'lucide-react';
import { loadBranding, fetchBrandingFromServer, BRANDING_UPDATED_EVENT } from '../utils/branding';

/* ── Restaurant constants — real Paradise Tomza (Paradise Kitchen) details ── */
const RESTAURANT_PHONE    = '+975 77467538';
const RESTAURANT_LOCATION = 'Norzin Lam 1, opposite Thimphu Thromde Office, near Clock Tower, Thimphu';

/* ── Nav link definitions ── */
const NAV_LINKS = [
  { key: 'home', label: 'Home',         to: '/' },
  { key: 'menu', label: 'Menu',         to: '/',    hash: '#menu' },
  { key: 'how',  label: 'How it works', to: '/',    hash: '#how' },
  { key: 'about', label: 'About',       to: '/about' },
  { key: 'order', label: 'Order Now',   to: '/order', cta: true },
];

const QUICK_LINKS = [
  { label: 'Home',              to: '/' },
  { label: 'Order Online',      to: '/order' },
  { label: 'About Us',          to: '/about' },
  { label: 'Privacy Policy',    to: '/privacy' },
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'Staff Login',       to: '/login' },
];

const HOURS = [
  { day: 'Mon – Sun', hours: '10 AM – 9 PM' },
];

/* ── Inline brand logo (respects admin branding) ── */
const BrandLogo = ({ branding, size = 40 }) => {
  const b = branding || loadBranding();
  const radius = b.logoShape === 'circle' ? '50%' : b.logoShape === 'square' ? 10 : 13;
  if (b.logo) {
    return (
      <img
        src={b.logo}
        alt={b.siteName}
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: radius,
        background: 'linear-gradient(135deg,#F59E0B,#EA580C)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 22px -8px rgba(245,158,11,0.7)',
        flexShrink: 0,
      }}
    >
      <Utensils size={Math.round(size * 0.46)} color="#1B0F02" strokeWidth={2.4} />
    </div>
  );
};

/* ================================================================== */
const PublicShell = ({ active = '', children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [branding,   setBranding]   = useState(() => loadBranding());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled,   setScrolled]   = useState(false);

  /* Live-update branding when admin changes it */
  useEffect(() => {
    const onBranding = () => setBranding(loadBranding());
    window.addEventListener(BRANDING_UPDATED_EVENT, onBranding);
    fetchBrandingFromServer().then(b => b && setBranding(b));
    return () => window.removeEventListener(BRANDING_UPDATED_EVENT, onBranding);
  }, []);

  /* Sticky-header state */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Close mobile drawer on route change + lock body scroll while open */
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [mobileOpen]);

  /* ── Route-change scroll reset ───────────────────────────────────
     Client-side navigation keeps the window's scroll offset, so tapping
     a footer link used to drop users halfway down — often straight at
     the footer — of the next page. Reset before paint (useLayoutEffect)
     so every page swap starts at the top; the hash effect below then
     glides to any anchor target from there. */
  const prevPathRef = useRef(null);
  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    /* BUGFIX (TOC/#anchor links snapped back to the top): this effect used to
       re-run — and re-pin the page to the top — whenever location.hash
       changed too. Clicking an in-page anchor ("On this page" lists on the
       privacy/terms pages, footer section links) changed only the hash, so
       the pin killed the smooth scroll that the hash effect below had just
       started. A hash-only jump on the SAME page is not a page change: skip
       the reset entirely and let the hash glow below glide to the target. */
    if (prevPathRef.current === location.pathname) return undefined;
    prevPathRef.current = location.pathname;

    /* BUGFIX (page loads at the bottom/footer): index.css sets
       `html { scroll-behavior: smooth }` globally. That means
       window.scrollTo(0,0) animates from the old (bottom) position to
       the top instead of jumping instantly — so users see the footer
       and then a slow scroll up. Temporarily switch to 'auto' for the
       reset calls, then restore the original value so in-page smooth
       scrolling (hash links, scrollIntoView) still works afterwards.
       Every retry also toggles to 'auto' around the scrollTo call so
       late-arriving content (lazy chunks, images) can't resurface a
       smooth-animated scroll from a mid-page position. */
    const html = document.documentElement;
    const savedBehavior = html.style.scrollBehavior;

    const resetScroll = () => {
      html.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      html.style.scrollBehavior = savedBehavior;
    };

    /* Re-pin on a timeline so late-arriving layout (lazy route chunks,
       images, ad banners) can't resurface the remembered viewport position.
       The tick stops as soon as the user acts by themselves — wheel, touch,
       key press, mouse press or click are all evidence they are navigating. */
    let userMoved = false;
    const markUser = () => { userMoved = true; };
    const evts = ['wheel', 'touchstart', 'keydown', 'mousedown', 'click'];
    evts.forEach((ev) => window.addEventListener(ev, markUser, { passive: true, once: true }));

    resetScroll();
    requestAnimationFrame(resetScroll);
    requestAnimationFrame(() => requestAnimationFrame(resetScroll));

    const ticks = [
      setTimeout(() => { if (!userMoved) resetScroll(); }, 250),
      setTimeout(() => { if (!userMoved) resetScroll(); }, 900),
      setTimeout(() => { if (!userMoved) resetScroll(); }, 1800),
    ];

    return () => {
      ticks.forEach((t) => clearTimeout(t));
      evts.forEach((ev) => window.removeEventListener(ev, markUser));
      html.style.scrollBehavior = savedBehavior;
    };
  }, [location.pathname, location.hash]);

  /* Hash-link scrolling — React Router pushState doesn't fire native anchors */
  const scrollToHash = useCallback((hash) => {
    const id = String(hash).replace(/^#/, '');
    const el = document.getElementById(id);
    if (!el) return false;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    return true;
  }, []);

  /* Handle direct load with hash (e.g. /#menu) and cross-page links.
     The target section can mount AFTER the page shell (lazy routes,
     fetch-driven sections), so retry for up to ~1.5s instead of the old
     single 120ms attempt that silently missed and left users at the
     bottom of the page. */
  useEffect(() => {
    if (!location.hash) return undefined;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const ok = scrollToHash(location.hash);
      if (ok || tries >= 9) clearInterval(timer);
    }, 170);
    return () => clearInterval(timer);
  }, [location, scrollToHash]);

  /* Scroll-reveal engine — observes .pw-reveal added by page content.
     A delayed rescan catches content that mounts after data loads. */
  useEffect(() => {
    const nodes = () => document.querySelectorAll('.pw-reveal:not(.pw-in)');
    if (typeof IntersectionObserver === 'undefined') {
      nodes().forEach(el => el.classList.add('pw-in'));
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('pw-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });

    const scan = () => nodes().forEach(el => io.observe(el));
    scan();
    const t1 = setTimeout(scan, 350);
    const t2 = setTimeout(scan, 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); io.disconnect(); };
  }, [location.pathname]);

  const siteName = branding?.siteName || 'Hotel POS';

  /* ── Nav item renderer ── */
  const NavLink = ({ l, mobile = false, index = 0 }) => {
    const isActive = active === l.key && !l.hash;
    const handleClick = (e) => {
      if (l.hash) {
        e.preventDefault();
        setMobileOpen(false);
        if (location.pathname === l.to) scrollToHash(l.hash);
        else navigate(`${l.to}${l.hash}`);
      } else {
        setMobileOpen(false);
      }
    };

    if (mobile) {
      return (
        <Link
          to={l.hash ? `${l.to}${l.hash}` : l.to}
          onClick={handleClick}
          className={`pw-drawer-link ${l.cta ? 'is-cta' : ''} ${isActive ? 'is-active' : ''}`}
          style={{ animationDelay: `${60 + index * 45}ms` }}
          aria-current={isActive ? 'page' : undefined}
        >
          <span>{l.label}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      );
    }

    return (
      <Link
        to={l.hash ? `${l.to}${l.hash}` : l.to}
        onClick={handleClick}
        className={`pw-nav-link ${l.cta ? 'pw-nav-cta' : ''} ${isActive ? 'is-active' : ''}`}
        aria-current={isActive ? 'page' : undefined}
      >
        {l.label}
      </Link>
    );
  };

  return (
    <div className="pw-root min-h-dvh flex flex-col">

      {/* ── Skip link (keyboard users) ── */}
      <a href="#pw-main" className="pw-skip">Skip to main content</a>

      {/* ── Announcement strip (scrolls away, header stays sticky) ── */}
      <div className="pw-announce">
        <div className="pw-container flex items-center justify-center gap-2 h-9 px-4">
          <span className="pw-announce-dot" aria-hidden="true" />
          <p className="text-[12px] sm:text-[12.5px] font-bold tracking-wide text-center">
            Free delivery on 3+ packs
            <span className="mx-2 opacity-50 hidden sm:inline" aria-hidden="true">•</span>
            <span className="hidden sm:inline">Open daily 10 AM – 9 PM</span>
            <a href={`tel:${RESTAURANT_PHONE.replace(/\s+/g, '')}`}
               className="hidden sm:inline underline underline-offset-2 hover:opacity-80">
              {RESTAURANT_PHONE}
            </a>
          </p>
        </div>
      </div>

      {/* ── Sticky header ── */}
      <header className={`pw-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="pw-container flex items-center h-16 lg:h-[72px] gap-3 sm:gap-5">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 min-w-0" aria-label={`${siteName} — home`}>
            <BrandLogo branding={branding} size={40} />
            <span className="hidden sm:flex flex-col leading-none min-w-0">
              <span className="pw-brand-name truncate">{siteName}</span>
              {branding?.showTagline && branding?.tagline && (
                <span className="pw-brand-tag truncate">{branding.tagline}</span>
              )}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-1 ml-3">
            {NAV_LINKS.filter(l => !l.cta).map(l => <NavLink key={l.key} l={l} />)}
          </nav>

          <div className="flex-1" />

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center gap-2.5">
            <NavLink l={NAV_LINKS.find(l => l.cta)} />
            <Link to="/login" className="pw-btn-ghost">Staff Login</Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(v => !v)}
            className="pw-icon-btn lg:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="pw-mobile-menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        <div className="pw-header-line" aria-hidden="true" />
      </header>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div id="pw-mobile-menu" className="pw-drawer" role="dialog" aria-modal="true" aria-label="Site menu">
          <div className="pw-drawer-backdrop" onClick={() => setMobileOpen(false)} />
          <div className="pw-drawer-panel">
            <div className="flex items-center justify-between gap-3 px-5 h-16 pw-rule-b">
              <span className="pw-brand-name">{siteName}</span>
              <button type="button" className="pw-icon-btn" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X size={22} />
              </button>
            </div>

            <nav aria-label="Mobile navigation" className="flex flex-col gap-2 p-4 overflow-y-auto flex-1">
              {NAV_LINKS.map((l, i) => <NavLink key={l.key} l={l} mobile index={i} />)}
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="pw-drawer-link is-quiet"
                style={{ animationDelay: `${60 + NAV_LINKS.length * 45}ms` }}
              >
                <span>Staff Login</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </nav>

            <div className="px-5 py-5 pw-rule-t space-y-2 text-[13px]">
              <a href={`tel:${RESTAURANT_PHONE.replace(/\s+/g, '')}`}
                 className="flex items-center gap-2 pw-muted hover:opacity-70 transition-colors">
                <Phone size={14} aria-hidden="true" /> {RESTAURANT_PHONE}
              </a>
              <p className="flex items-center gap-2 pw-muted">
                <Clock size={14} aria-hidden="true" /> Open daily · 10 AM – 9 PM
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Page content ── */}
      <main id="pw-main" className="pw-page flex-1 outline-none" tabIndex={-1}>
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="pw-footer">
        <div className="pw-footer-glow" aria-hidden="true" />

        <div className="pw-container relative px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20">

          {/* Top: brand + CTA */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-10 pw-rule-b">
            <div className="flex items-center gap-3">
              <BrandLogo branding={branding} size={52} />
              <div className="leading-none">
                <span className="block pw-ink font-extrabold text-xl tracking-tight">{siteName}</span>
                <span className="block text-[10.5px] font-bold tracking-[0.18em] uppercase mt-1.5" style={{ color: '#C2410C' }}>
                  {branding?.tagline || 'Restaurant'}
                </span>
              </div>
            </div>
            <Link to="/order" className="pw-btn-primary self-start lg:self-auto">
              Order online <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>

          {/* Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 py-10 sm:py-12">

            {/* Brand column */}
            <div className="sm:col-span-2 lg:col-span-1">
              <p className="pw-muted text-[14px] leading-relaxed max-w-xs">
                Authentic tomza — a complete Bhutanese meal wrapped in fresh banana leaf —
                delivered hot across Thimphu.
              </p>
              <div className="flex items-center gap-2 mt-5">
                <span className="flex items-center gap-0.5" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map(s => <Star key={s} size={13} fill="#F59E0B" color="#F59E0B" />)}
                </span>
                <span className="pw-muted text-[12.5px] font-semibold">4.5 / 5 · 40+ Google reviews</span>
              </div>
              <p className="mt-5 text-[12.5px] pw-muted leading-relaxed">
                Run by Ms. Tashi Chezom · Norzin Lam 1, Thimphu
              </p>
            </div>

            {/* Quick links */}
            <nav aria-label="Footer">
              <h3 className="pw-footer-title">Quick Links</h3>
              <ul className="space-y-1">
                {QUICK_LINKS.map(({ label, to }) => (
                  <li key={label}>
                    <Link to={to} className="pw-footer-link">
                      <ChevronRight size={13} aria-hidden="true" /> {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Opening hours */}
            <div>
              <h3 className="pw-footer-title">Opening Hours</h3>
              <ul className="space-y-2.5">
                {HOURS.map(({ day, hours }) => (
                  <li key={day} className="flex items-center justify-between gap-3">
                    <span className="pw-muted text-[13px]">{day}</span>
                    <span className="pw-hours-chip">{hours}</span>
                  </li>
                ))}
              </ul>
              <p className="flex items-center gap-2 mt-4 text-[12.5px] font-semibold text-emerald-400">
                <span className="pw-dot-ok" aria-hidden="true" /> Fresh batches daily, wrapped in banana leaf
              </p>
            </div>

            {/* Contact */}
            <div>
              <h3 className="pw-footer-title">Contact Us</h3>
              <ul className="space-y-3">
                {[
                  { icon: <Phone size={14} />,  label: RESTAURANT_PHONE,     href: `tel:${RESTAURANT_PHONE.replace(/\s+/g, '')}`, tone: '52,211,153' },
                  { icon: <MapPin size={14} />, label: RESTAURANT_LOCATION,  href: '#', tone: '248,113,113' },
                ].map(({ icon, label, href, tone }) => (
                  <li key={label}>
                    <a href={href} className="pw-footer-contact" style={{ '--tone': tone }}>
                      <span className="pw-footer-contact-icon" aria-hidden="true">{icon}</span>
                      <span className="break-words">{label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-6 pw-rule-t">
            <p className="pw-muted text-[12.5px] text-center sm:text-left">
              © {new Date().getFullYear()} <strong style={{ color: 'var(--pw-ink)' }}>{siteName}</strong>. All rights reserved.
            </p>
            <div className="flex items-center gap-5 flex-wrap justify-center">
              {[{ label: 'Privacy Policy', to: '/privacy' }, { label: 'Terms of Service', to: '/terms' }, { label: 'About', to: '/about' }]
                .map(({ label, to }) => (
                  <Link key={label} to={to} className="pw-footer-legal">{label}</Link>
                ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── Design tokens + shell styles ── */}
      <style>{`
        .pw-root{
          --pw-bg:#FFF8F1;
          --pw-bg-2:#FCEFE1;
          --pw-panel:#FFFFFF;
          --pw-panel-2:#FFF4E8;
          --pw-line:rgba(63,32,4,0.12);
          --pw-ink:#221207;
          --pw-sub:#5C4B3A;
          --pw-muted:#7A6553;
          --pw-accent:#F59E0B;
          --pw-accent-2:#EA580C;
          --pw-ink-on-accent:#1B0F02;
          --pw-grad:linear-gradient(135deg,#F59E0B 0%,#EA580C 100%);
          --pw-ease:cubic-bezier(0.22,1,0.36,1);
          background:var(--pw-bg);
          color:var(--pw-ink);
          font-family:'Inter',system-ui,sans-serif;
          -webkit-font-smoothing:antialiased;
          overflow-x:hidden;
        }
        .pw-root *,.pw-root *::before,.pw-root *::after{box-sizing:border-box;}
        .pw-root section[id]{scroll-margin-top:88px;}
        .pw-container{width:100%;max-width:80rem;margin-inline:auto;}

        /* Text roles (immune to the app-wide dark-mode !important overrides) */
        .pw-sub{color:var(--pw-sub);}
        .pw-muted{color:var(--pw-muted);}
        .pw-line{border-color:var(--pw-line);}
        .pw-ink{color:var(--pw-ink);}
        .pw-rule-b{border-bottom:1px solid var(--pw-line);}
        .pw-rule-t{border-top:1px solid var(--pw-line);}

        /* Skip link */
        .pw-skip{
          position:absolute;left:12px;top:-60px;z-index:200;
          background:var(--pw-ink);color:#FFF6EA;font-weight:700;font-size:13px;
          padding:10px 16px;border-radius:10px;transition:top .2s var(--pw-ease);text-decoration:none;
        }
        .pw-skip:focus{top:12px;}

        /* Announcement */
        .pw-announce{
          background:var(--pw-grad);color:var(--pw-ink-on-accent);
          position:relative;z-index:70;
        }
        .pw-announce a{color:inherit;}
        .pw-announce-dot{
          width:7px;height:7px;border-radius:50%;background:#1B0F02;
          box-shadow:0 0 0 0 rgba(27,15,2,0.55);animation:pwPulse 2s infinite;flex-shrink:0;
        }
        @keyframes pwPulse{
          0%{box-shadow:0 0 0 0 rgba(27,15,2,0.5);}
          70%{box-shadow:0 0 0 7px rgba(27,15,2,0);}
          100%{box-shadow:0 0 0 0 rgba(27,15,2,0);}
        }

        /* Header */
        .pw-header{
          position:sticky;top:0;z-index:60;
          background:rgba(255,248,241,0.8);
          backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
          transition:background .3s var(--pw-ease),box-shadow .3s var(--pw-ease);
        }
        .pw-header.is-scrolled{
          background:rgba(255,251,245,0.96);
          box-shadow:0 10px 30px -18px rgba(63,32,4,0.25);
        }
        .pw-header-line{
          height:1px;width:100%;
          background:linear-gradient(90deg,transparent,rgba(245,158,11,0.35),rgba(234,88,12,0.25),transparent);
          opacity:.5;transition:opacity .3s var(--pw-ease);
        }
        .pw-header.is-scrolled .pw-header-line{opacity:1;}

        .pw-brand-name{
          font-weight:800;font-size:16px;letter-spacing:-0.02em;color:var(--pw-ink);
          font-family:'Playfair Display',Georgia,serif;
        }
        .pw-brand-tag{
          font-size:9.5px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;
          color:#C2410C;margin-top:4px;
        }

        .pw-nav-link{
          position:relative;display:inline-flex;align-items:center;
          padding:9px 14px;border-radius:999px;
          font-size:13.5px;font-weight:600;letter-spacing:-0.01em;
          color:var(--pw-sub);text-decoration:none;
          transition:color .2s var(--pw-ease),background .2s var(--pw-ease);
          min-height:40px;
        }
        .pw-nav-link:hover{color:var(--pw-ink);background:rgba(234,88,12,0.08);}
        .pw-nav-link.is-active{color:#1B0F02;background:var(--pw-grad);box-shadow:0 6px 18px -8px rgba(245,158,11,0.8);}
        .pw-nav-link.pw-nav-cta{
          color:var(--pw-ink-on-accent);background:var(--pw-grad);font-weight:800;
          padding:10px 20px;box-shadow:0 10px 26px -12px rgba(245,158,11,0.9);
        }
        .pw-nav-link.pw-nav-cta:hover{background:linear-gradient(135deg,#FBBF24,#F97316);color:var(--pw-ink-on-accent);transform:translateY(-1px);}
        .pw-nav-link.pw-nav-cta:active{transform:translateY(0) scale(0.98);}

        .pw-btn-ghost{
          display:inline-flex;align-items:center;justify-content:center;
          min-height:40px;padding:0 18px;border-radius:999px;
          border:1px solid rgba(63,32,4,0.2);
          font-size:13px;font-weight:700;color:var(--pw-sub);text-decoration:none;
          transition:all .2s var(--pw-ease);
        }
        .pw-btn-ghost:hover{color:var(--pw-ink);border-color:rgba(63,32,4,0.42);background:rgba(234,88,12,0.06);}

        .pw-icon-btn{
          display:inline-flex;align-items:center;justify-content:center;
          width:44px;height:44px;border-radius:14px;color:var(--pw-ink);
          background:rgba(63,32,4,0.05);border:1px solid var(--pw-line);
          transition:background .2s var(--pw-ease),transform .15s var(--pw-ease);
        }
        .pw-icon-btn:hover{background:rgba(63,32,4,0.1);}
        .pw-icon-btn:active{transform:scale(0.94);}

        /* Buttons */
        .pw-btn-primary{
          display:inline-flex;align-items:center;justify-content:center;gap:8px;
          min-height:48px;padding:0 26px;border-radius:14px;
          background:var(--pw-grad);color:var(--pw-ink-on-accent);
          font-weight:800;font-size:15px;text-decoration:none;
          box-shadow:0 16px 34px -16px rgba(245,158,11,0.95);
          transition:transform .2s var(--pw-ease),box-shadow .2s var(--pw-ease),filter .2s var(--pw-ease);
        }
        .pw-btn-primary:hover{transform:translateY(-2px);filter:brightness(1.06);box-shadow:0 22px 42px -18px rgba(245,158,11,1);}
        .pw-btn-primary:active{transform:translateY(0) scale(0.98);}
        .pw-btn-primary:disabled{opacity:.55;transform:none;cursor:not-allowed;}

        .pw-btn-ghost-lg{
          display:inline-flex;align-items:center;justify-content:center;gap:8px;
          min-height:48px;padding:0 26px;border-radius:14px;
          background:rgba(255,255,255,0.65);border:1px solid var(--pw-line);
          color:var(--pw-ink);font-weight:700;font-size:15px;text-decoration:none;
          transition:all .2s var(--pw-ease);
        }
        .pw-btn-ghost-lg:hover{background:#fff;border-color:rgba(63,32,4,0.28);transform:translateY(-2px);}
        .pw-btn-ghost-lg:active{transform:translateY(0) scale(0.98);}

        /* Eyebrow / chips */
        .pw-eyebrow{
          display:inline-flex;align-items:center;gap:8px;
          padding:7px 14px;border-radius:999px;
          background:rgba(234,88,12,0.09);border:1px solid rgba(234,88,12,0.3);
          color:#C2410C;font-size:11.5px;font-weight:800;
          letter-spacing:0.14em;text-transform:uppercase;
        }
        .pw-chip{
          display:inline-flex;align-items:center;gap:7px;
          padding:8px 14px;border-radius:999px;min-height:36px;
          background:rgba(255,255,255,0.05);border:1px solid var(--pw-line);
          color:var(--pw-sub);font-size:12.5px;font-weight:600;
        }

        /* Cards */
        .pw-card{
          background:var(--pw-panel);border:1px solid var(--pw-line);
          border-radius:20px;transition:transform .3s var(--pw-ease),border-color .3s var(--pw-ease),background .3s var(--pw-ease);
        }
        .pw-card:hover{border-color:rgba(245,158,11,0.35);background:var(--pw-panel-2);}

        /* Mobile drawer */
        .pw-drawer{position:fixed;inset:0;z-index:90;display:flex;justify-content:flex-end;}
        .pw-drawer-backdrop{position:absolute;inset:0;background:rgba(38,21,7,0.5);backdrop-filter:blur(6px);animation:pwFade .25s var(--pw-ease) both;}
        .pw-drawer-panel{
          position:relative;width:min(22rem,88vw);height:100%;
          background:#FFF8F1;border-left:1px solid var(--pw-line);
          display:flex;flex-direction:column;
          animation:pwSlideIn .35s var(--pw-ease) both;
          box-shadow:-30px 0 60px -30px rgba(63,32,4,0.35);
        }
        .pw-drawer-link{
          display:flex;align-items:center;justify-content:space-between;gap:12px;
          min-height:52px;padding:12px 16px;border-radius:14px;
          font-size:16px;font-weight:700;color:#3F2F20;text-decoration:none;
          background:rgba(63,32,4,0.04);border:1px solid transparent;
          animation:pwFadeUp .4s var(--pw-ease) both;
          transition:background .2s var(--pw-ease),color .2s var(--pw-ease);
        }
        .pw-drawer-link svg{opacity:.45;transition:opacity .2s var(--pw-ease),transform .2s var(--pw-ease);}
        .pw-drawer-link:hover{background:rgba(234,88,12,0.09);color:var(--pw-ink);}
        .pw-drawer-link:hover svg{opacity:1;transform:translateX(3px);}
        .pw-drawer-link.is-active{background:rgba(234,88,12,0.1);border-color:rgba(234,88,12,0.4);color:#C2410C;}
        .pw-drawer-link.is-cta{background:var(--pw-grad);color:var(--pw-ink-on-accent);border-color:transparent;}
        .pw-drawer-link.is-cta svg{opacity:.8;}
        .pw-drawer-link.is-quiet{background:transparent;color:var(--pw-muted);border-color:var(--pw-line);}
        @keyframes pwFade{from{opacity:0}to{opacity:1}}
        @keyframes pwFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes pwSlideIn{from{transform:translateX(100%)}to{transform:none}}

        /* Footer */
        .pw-footer{
          position:relative;overflow:hidden;
          background:
            radial-gradient(700px 300px at 8% -10%,rgba(245,158,11,0.14),transparent 65%),
            radial-gradient(600px 320px at 100% 110%,rgba(234,88,12,0.1),transparent 60%),
            linear-gradient(180deg,#FFF4E6 0%,#FDEDD9 60%,#FBE7D0 100%);
          border-top:1px solid var(--pw-line);
        }
        .pw-footer-glow{
          position:absolute;top:-140px;left:50%;transform:translateX(-50%);
          width:min(760px,120vw);height:220px;border-radius:50%;
          background:radial-gradient(closest-side,rgba(245,158,11,0.12),transparent);
          pointer-events:none;
        }
        .pw-footer-title{
          font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;
          color:var(--pw-ink);margin:0 0 18px;
        }
        .pw-footer-link{
          display:inline-flex;align-items:center;gap:7px;
          color:var(--pw-muted);font-size:13.5px;text-decoration:none;
          padding:5px 0;transition:color .2s var(--pw-ease),transform .2s var(--pw-ease);
        }
        .pw-footer-link svg{color:#EA580C;flex-shrink:0;transition:transform .2s var(--pw-ease);}
        .pw-footer-link:hover{color:var(--pw-ink);transform:translateX(4px);}
        .pw-footer-link:hover svg{transform:translateX(2px);}
        .pw-hours-chip{
          font-size:11px;font-weight:700;white-space:nowrap;
          padding:3px 9px;border-radius:7px;
          background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);color:#047857;
        }
        .pw-dot-ok{
          width:7px;height:7px;border-radius:50%;background:#059669;display:inline-block;
          box-shadow:0 0 0 3px rgba(5,150,105,0.18);
        }
        .pw-footer-contact{
          display:flex;align-items:flex-start;gap:11px;
          color:var(--pw-muted);font-size:13.5px;text-decoration:none;line-height:1.6;
          transition:color .2s var(--pw-ease);
        }
        .pw-footer-contact:hover{color:var(--pw-ink);}
        .pw-footer-contact-icon{
          width:30px;height:30px;border-radius:9px;flex-shrink:0;margin-top:2px;
          display:flex;align-items:center;justify-content:center;
          background:rgba(var(--tone),0.13);
          border:1px solid rgba(var(--tone),0.32);
          color:rgb(var(--tone));
        }
        .pw-social{
          width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;
          background:rgba(255,255,255,0.06);border:1px solid var(--pw-line);color:var(--pw-muted);
          text-decoration:none;
          transition:all .2s var(--pw-ease);
        }
        .pw-social:hover{
          background:var(--social);border-color:var(--social);color:#fff;
          transform:translateY(-3px);
        }
        .pw-footer-legal{
          color:#7A6553;font-size:12.5px;text-decoration:none;transition:color .2s var(--pw-ease);
        }
        .pw-footer-legal:hover{color:#C2410C;}

        /* Page-enter transition — the shell remounts on every route change,
           so this plays once per navigation: content fades up from the top
           right after the scroll reset, instead of a hard cut. */
        .pw-page{animation:pwPageIn .5s var(--pw-ease) both;}
        @keyframes pwPageIn{
          from{opacity:0;transform:translateY(16px);}
          to{opacity:1;transform:none;}
        }

        /* Scroll reveal */
        .pw-reveal{opacity:0;transform:translateY(20px);
          transition:opacity .65s var(--pw-ease),transform .65s var(--pw-ease);}
        .pw-reveal.pw-in{opacity:1;transform:none;}

        /* ══════════════════ RECHARGE FX (GPU-safe: transform/opacity only) ══════════════════ */
        /* Animated gradient headline */
        .pw-fx-shimmer{background-size:220% auto !important;animation:pwShimmer 5.5s linear infinite;}
        @keyframes pwShimmer{to{background-position:220% center}}

        /* Light-sweep on hover for cards & buttons */
        .pw-fx-sheen{position:relative;overflow:hidden;}
        .pw-fx-sheen::after{
          content:"";position:absolute;top:0;left:-85%;width:55%;height:100%;
          background:linear-gradient(100deg,transparent,rgba(255,255,255,0.14),transparent);
          transform:skewX(-16deg);transition:left .55s var(--pw-ease);pointer-events:none;
        }
        .pw-fx-sheen:hover::after{left:135%;}

        /* Gentle levitation loops (two phases, so pairs of cards drift apart) */
        .pw-fx-float{animation:pwFloat 5.5s ease-in-out infinite;}
        .pw-fx-float-b{animation:pwFloat 6.5s ease-in-out -1.4s infinite;}
        @keyframes pwFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}

        /* Ambient drifting aurora orbs (blur is static; only translate animates) */
        .pw-fx-orb{position:absolute;border-radius:50%;filter:blur(46px);pointer-events:none;will-change:transform;}
        .pw-fx-orb-a{animation:pwOrbA 14s ease-in-out infinite;}
        .pw-fx-orb-b{animation:pwOrbB 18s ease-in-out infinite;}
        @keyframes pwOrbA{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(38px,-26px) scale(1.14)}}
        @keyframes pwOrbB{0%,100%{transform:translate(0,0) scale(1.04)}50%{transform:translate(-30px,22px) scale(0.94)}}

        /* Infinite dish marquee */
        .pw-fx-marquee{overflow:hidden;}
        .pw-fx-marquee-inner{display:flex;width:max-content;animation:pwMarquee 32s linear infinite;}
        .pw-fx-marquee:hover .pw-fx-marquee-inner{animation-play-state:paused;}
        @keyframes pwMarquee{to{transform:translateX(-50%)}}

        /* Subtle 3D tilt on hover (cards / tiles) */
        .pw-fx-tilt{transition:transform .3s var(--pw-ease),box-shadow .3s var(--pw-ease);}
        .pw-fx-tilt:hover{transform:perspective(700px) rotateX(2.5deg) rotateY(-2.5deg) translateY(-5px);}

        /* Pulsing glow behind the hero CTA */
        .pw-fx-glow{position:relative;}
        .pw-fx-glow::before{
          content:"";position:absolute;inset:-10px -14px;border-radius:inherit;z-index:-1;
          background:radial-gradient(closest-side,rgba(245,158,11,0.45),transparent);
          animation:pwGlowPulse 3.2s ease-in-out infinite;
        }
        @keyframes pwGlowPulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}

        @media (prefers-reduced-motion: reduce){
          .pw-page{animation:none !important;}
          .pw-reveal{opacity:1 !important;transform:none !important;transition:none !important;}
          .pw-announce-dot{animation:none;}
          .pw-drawer-panel,.pw-drawer-link,.pw-drawer-backdrop{animation:none !important;}
          .pw-root *{scroll-behavior:auto !important;}
          .pw-fx-shimmer,.pw-fx-float,.pw-fx-float-b,
          .pw-fx-orb-a,.pw-fx-orb-b,.pw-fx-marquee-inner,
          .pw-fx-tilt,.pw-fx-glow::before{animation:none !important;}
        }

        /* ── Keyboard focus-visible (amber, scoped to public pages) ──
           The global :focus-visible uses #3B82F6 (blue) which clashes
           with the warm amber palette. Override with amber-themed rings
           for all interactive elements inside .pw-root. */
        .pw-root a:focus-visible,
        .pw-root button:focus-visible,
        .pw-root [role="button"]:focus-visible,
        .pw-root input:focus-visible,
        .pw-root select:focus-visible,
        .pw-root textarea:focus-visible {
          outline: 2px solid #EA580C;
          outline-offset: 2px;
          border-radius: 6px;
        }
        .pw-root .pw-nav-link:focus-visible {
          outline: 2px solid #EA580C;
          outline-offset: 2px;
          background: rgba(234,88,12,0.12);
        }
        .pw-root .pw-btn-primary:focus-visible,
        .pw-root .pw-nav-cta:focus-visible {
          outline: 2px solid #1B0F02;
          outline-offset: 3px;
          box-shadow: 0 0 0 4px rgba(245,158,11,0.4);
        }
        .pw-root .pw-btn-ghost-lg:focus-visible,
        .pw-root .pw-btn-ghost:focus-visible {
          outline: 2px solid #EA580C;
          outline-offset: 2px;
        }
        .pw-root .pw-icon-btn:focus-visible {
          outline: 2px solid #EA580C;
          outline-offset: 2px;
        }
        .pw-root .pw-drawer-link:focus-visible {
          outline: 2px solid #EA580C;
          outline-offset: -2px;
        }
        .pw-root .pw-footer-link:focus-visible,
        .pw-root .pw-footer-legal:focus-visible {
          outline: 2px solid #EA580C;
          outline-offset: 2px;
          border-radius: 4px;
        }
        .pw-root .pw-skip:focus {
          outline: none;
        }
        /* Card links with overflow-hidden would clip the outline —
           use an inset ring instead so focus is still visible. */
        .pw-root .pw-card:focus-visible,
        .pw-root a[class*="overflow-hidden"]:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px #EA580C, 0 0 0 5px rgba(245,158,11,0.3);
        }

        /* ═══════════════════════════════════════════════════════════
           Dark mode — the global html.dark overrides flip backgrounds to
           dark navy, but .pw-root sets its own light tokens. We need to
           either: (a) keep pw-root light in dark mode (forces light page),
           or (b) adapt pw-root to dark. Going with (b) — adapt to dark
           so the public pages look good in both themes.
           The !important is needed to beat the global html.dark !important
           rules for body/background.
        ════════════════════════════════════════════════════════════ */
        html.dark .pw-root {
          --pw-bg:#0F172A !important;
          --pw-bg-2:#1E293B !important;
          --pw-panel:#1E293B !important;
          --pw-panel-2:#1A2336 !important;
          --pw-line:rgba(255,255,255,0.1) !important;
          --pw-ink:#F1F5F9 !important;
          --pw-sub:#CBD5E1 !important;
          --pw-muted:#94A3B8 !important;
          --pw-accent:#F59E0B !important;
          --pw-accent-2:#EA580C !important;
          --pw-ink-on-accent:#1B0F02 !important;
          --pw-grad:linear-gradient(135deg,#F59E0B 0%,#EA580C 100%) !important;
          background:var(--pw-bg) !important;
          color:var(--pw-ink) !important;
        }
        html.dark .pw-header {
          background:rgba(15,23,42,0.85) !important;
        }
        html.dark .pw-header.is-scrolled {
          background:rgba(15,23,42,0.97) !important;
          box-shadow:0 10px 30px -18px rgba(0,0,0,0.5) !important;
        }
        html.dark .pw-cat-strip,
        html.dark .dm-filters {
          background:rgba(15,23,42,0.92) !important;
          border-bottom-color:rgba(255,255,255,0.08) !important;
        }
        html.dark .pw-card {
          background:#1E293B !important;
          border-color:rgba(255,255,255,0.08) !important;
        }
        html.dark .pw-card:hover {
          border-color:rgba(245,158,11,0.35) !important;
          background:#243149 !important;
        }
        html.dark .pw-chip {
          background:rgba(255,255,255,0.06) !important;
          border-color:var(--pw-line) !important;
          color:var(--pw-sub) !important;
        }
        html.dark .pw-btn-ghost-lg {
          background:rgba(255,255,255,0.06) !important;
          border-color:var(--pw-line) !important;
          color:var(--pw-ink) !important;
        }
        html.dark .pw-drawer-panel {
          background:#1E293B !important;
          border-left-color:var(--pw-line) !important;
        }
        html.dark .pw-drawer-link {
          background:rgba(255,255,255,0.04) !important;
          color:#E2E8F0 !important;
        }
        html.dark .pw-drawer-link:hover {
          background:rgba(245,158,11,0.09) !important;
          color:#fff !important;
        }
        html.dark .pw-footer {
          background:
            radial-gradient(700px 300px at 8% -10%,rgba(245,158,11,0.1),transparent 65%),
            radial-gradient(600px 320px at 100% 110%,rgba(234,88,12,0.08),transparent 60%),
            linear-gradient(180deg,#1A2336 0%,#0F172A 60%,#0B1220 100%) !important;
          border-top-color:var(--pw-line) !important;
        }
        html.dark .pw-eyebrow {
          background:rgba(245,158,11,0.12) !important;
          border-color:rgba(245,158,11,0.35) !important;
          color:#FBBF24 !important;
        }
        /* DeliveryMenu form inputs */
        html.dark .pw-root .df-input,
        html.dark .pw-root .dm-input {
          background:#1A2336 !important;
          border-color:rgba(255,255,255,0.12) !important;
          color:var(--pw-ink) !important;
        }
        html.dark .pw-root .df-input::placeholder,
        html.dark .pw-root .dm-input::placeholder {
          color:#64748B !important;
        }
        html.dark .pw-root .df-note-btn {
          background:rgba(255,255,255,0.04) !important;
          border-color:rgba(255,255,255,0.12) !important;
          color:var(--pw-sub) !important;
        }
        html.dark .pw-root .dm-payopt {
          background:rgba(255,255,255,0.04) !important;
          border-color:rgba(255,255,255,0.1) !important;
          color:var(--pw-ink) !important;
        }
        html.dark .pw-root .dm-payopt:hover {
          background:rgba(255,255,255,0.08) !important;
        }
        html.dark .pw-root .dm-cart-item {
          background:rgba(255,255,255,0.04) !important;
          border-color:rgba(255,255,255,0.08) !important;
        }
        html.dark .pw-root .dm-panel {
          background:#1E293B !important;
          border-left-color:var(--pw-line) !important;
        }
        html.dark .pw-root .dm-cart-foot {
          background:rgba(15,23,42,0.97) !important;
          border-top-color:var(--pw-line) !important;
        }
        html.dark .pw-root .df-submit {
          background:rgba(15,23,42,0.97) !important;
          border-top-color:var(--pw-line) !important;
        }
        /* HomeLanding hero stage */
        html.dark .hl-stage {
          background:#1A2336 !important;
          border-color:rgba(245,158,11,0.25) !important;
        }
        html.dark .hl-stat {
          background:#1E293B !important;
          border-color:rgba(255,255,255,0.08) !important;
        }
        html.dark .hl-steps {
          color:#CBD5E1 !important;
        }
        /* Dark Tomza band already has dark overrides via .tz-dark */
      `}</style>
    </div>
  );
};

export { BrandLogo };
export default PublicShell;
