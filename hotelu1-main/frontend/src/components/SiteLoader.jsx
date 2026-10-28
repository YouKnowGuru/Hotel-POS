import React, { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import {
  loadBranding,
  BRANDING_UPDATED_EVENT,
} from '../utils/branding';

/* Inject the scoped CSS exactly once at module load. Previously a
   <style>{SITE_LOADER_CSS}</style> tag was rendered inside the component,
   which re-injected ~330 lines of CSS into the DOM on every render
   (e.g. every time branding state changed). */
let _cssInjected = false;
function injectCSS() {
  if (_cssInjected) return;
  if (typeof document === 'undefined') return;
  const tag = document.createElement('style');
  tag.setAttribute('data-site-loader', '');
  tag.textContent = SITE_LOADER_CSS;
  document.head.appendChild(tag);
  _cssInjected = true;
}

/**
 * SiteLoader — a super-modern full-screen boot loader.
 *
 * Pulls the admin's branding (logo, site name, tagline, logo shape)
 * from Settings → Branding so every device shows the real identity.
 *
 * Visual layers (all CSS-only, no deps):
 *   • Full-screen gradient backdrop with animated aurora blobs
 *   • Glassmorphic card center stage
 *   • Logo with scale-in + breathe pulse, glowing ring
 *   • Site name (typographic fade-up) + tagline
 *   • Animated 3-dot loading indicator
 *   • Bottom shimmer progress bar
 *
 * Replaces the old LoadingSpinner in App.jsx (both the isLoading gate
 * and the Suspense fallback).
 */
const SiteLoader = ({ minimal = false }) => {
  const [branding, setBranding] = useState(() => loadBranding());

  useEffect(() => {
    const reload = () => setBranding(loadBranding());
    window.addEventListener(BRANDING_UPDATED_EVENT, reload);
    return () => window.removeEventListener(BRANDING_UPDATED_EVENT, reload);
  }, []);

  const radius =
    branding.logoShape === 'circle'
      ? '9999px'
      : branding.logoShape === 'square'
        ? '4px'
        : '16px';

  /* ----- minimal variant (used as Suspense fallback — lighter) ----- */
  if (minimal) {
    return (
      <div className="site-loader-root site-loader-minimal">
        <div className="site-loader-orb">
          {branding.logo ? (
            <img
              src={branding.logo}
              alt={branding.siteName}
              className="site-loader-logo-img"
            />
          ) : (
            <Flame className="site-loader-flame" />
          )}
        </div>
        <span className="site-loader-dots">
          <i /><i /><i />
        </span>
      </div>
    );
  }

  /* ----- full boot loader ----- */
  return (
    <div className="site-loader-root">
      {/* Animated aurora background */}
      <div className="site-loader-bg">
        <span className="site-loader-blob blob-1" />
        <span className="site-loader-blob blob-2" />
        <span className="site-loader-blob blob-3" />
      </div>

      {/* Grain / vignette overlay */}
      <div className="site-loader-vignette" />

      {/* Center stage */}
      <div className="site-loader-card">
        {/* Glowing ring behind logo */}
        <div className="site-loader-ring-outer">
          <div className="site-loader-ring-inner" />

          {/* Logo container */}
          <div
            className="site-loader-logo"
            style={{
              borderRadius: radius,
              background: branding.logo
                ? 'rgba(255,255,255,0.97)'
                : 'linear-gradient(135deg, var(--theme-gold, #D4A017) 0%, var(--theme-gold-dark, #B8860B) 100%)',
            }}
          >
            {branding.logo ? (
              <img
                src={branding.logo}
                alt={branding.siteName}
                className="site-loader-logo-img"
              />
            ) : (
              <Flame className="site-loader-flame" />
            )}
          </div>
        </div>

        {/* Site name */}
        <h1 className="site-loader-name">{branding.siteName}</h1>

        {/* Tagline */}
        {branding.showTagline && branding.tagline ? (
          <p className="site-loader-tagline">{branding.tagline}</p>
        ) : null}

        {/* 3-dot loading indicator */}
        <div className="site-loader-dots">
          <span /><span /><span />
        </div>

        {/* Shimmer progress bar */}
        <div className="site-loader-bar">
          <div className="site-loader-bar-fill" />
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────── */
/*  Scoped CSS                                                          */
/* ──────────────────────────────────────────────────────────────────── */

const SITE_LOADER_CSS = `
/* ===== Root container ===== */
.site-loader-root {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  z-index: 9999;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;

  /* Deep gradient backdrop (light) */
  background:
    radial-gradient(ellipse at top left, #eef2ff 0%, transparent 55%),
    radial-gradient(ellipse at bottom right, #fef3c7 0%, transparent 55%),
    linear-gradient(160deg, #f8fafc 0%, #e2e8f0 100%);
}

html.dark .site-loader-root {
  background:
    radial-gradient(ellipse at top left, #1e293b 0%, transparent 55%),
    radial-gradient(ellipse at bottom right, #1a1206 0%, transparent 55%),
    linear-gradient(160deg, #0b1220 0%, #0d1526 100%);
}

/* ===== Minimal variant (Suspense fallback) =====
   Previously this was transparent, which meant the fixed app wrappers
   (DashboardLayout / MenuLayout with zIndex:10 and a solid background)
   showed THROUGH the loader — the user saw a blank grey screen instead
   of the loader. Give it the same opaque backdrop as the full loader. */
.site-loader-minimal {
  background:
    radial-gradient(ellipse at top left, #eef2ff 0%, transparent 55%),
    radial-gradient(ellipse at bottom right, #fef3c7 0%, transparent 55%),
    linear-gradient(160deg, #f8fafc 0%, #e2e8f0 100%) !important;
}
html.dark .site-loader-minimal {
  background:
    radial-gradient(ellipse at top left, #1e293b 0%, transparent 55%),
    radial-gradient(ellipse at bottom right, #1a1206 0%, transparent 55%),
    linear-gradient(160deg, #0b1220 0%, #0d1526 100%) !important;
}
.site-loader-minimal .site-loader-orb {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--theme-gold, #D4A017) 0%, var(--theme-gold-dark, #B8860B) 100%);
  box-shadow: 0 8px 30px color-mix(in srgb, var(--theme-gold, #D4A017) 35%, transparent);
  animation: sl-breathe 1.6s ease-in-out infinite;
}
.site-loader-minimal .site-loader-dots {
  position: absolute;
  bottom: 14px;
  display: flex;
  gap: 5px;
}
.site-loader-minimal .site-loader-dots i {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #94a3b8;
  animation: sl-dot-bounce 1.2s ease-in-out infinite;
}
.site-loader-minimal .site-loader-dots i:nth-child(2) { animation-delay: 0.15s; }
.site-loader-minimal .site-loader-dots i:nth-child(3) { animation-delay: 0.3s; }

/* ===== Animated aurora blobs ===== */
.site-loader-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.site-loader-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.5;
  animation: sl-drift 12s ease-in-out infinite;
}
.blob-1 {
  width: 340px; height: 340px;
  top: -80px; left: -60px;
  background: radial-gradient(circle, rgba(99,102,241,0.45), transparent 70%);
}
.blob-2 {
  width: 300px; height: 300px;
  bottom: -70px; right: -50px;
  background: radial-gradient(circle, rgba(212,160,23,0.40), transparent 70%);
  animation-delay: -3s;
}
.blob-3 {
  width: 260px; height: 260px;
  top: 45%; left: 55%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(139,92,246,0.30), transparent 70%);
  animation-delay: -6s;
}
html.dark .blob-1 {
  background: radial-gradient(circle, rgba(79,70,229,0.35), transparent 70%);
}
html.dark .blob-2 {
  background: radial-gradient(circle, rgba(212,160,23,0.25), transparent 70%);
  opacity: 0.4;
}
html.dark .blob-3 {
  background: radial-gradient(circle, rgba(109,40,217,0.25), transparent 70%);
  opacity: 0.35;
}

/* ===== Vignette overlay ===== */
.site-loader-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.06) 100%);
}
html.dark .site-loader-vignette {
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.25) 100%);
}

/* ===== Glassmorphic card ===== */
.site-loader-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 56px 40px;
  border-radius: 28px;
  background: rgba(255,255,255,0.65);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.7);
  box-shadow:
    0 20px 60px rgba(15,23,42,0.10),
    0 1px 0 rgba(255,255,255,0.8) inset;
  animation: sl-card-in 0.6s cubic-bezier(0.16,1,0.3,1) both;
  z-index: 1;
}
html.dark .site-loader-card {
  background: rgba(20,28,46,0.60);
  border: 1px solid rgba(99,102,241,0.15);
  box-shadow:
    0 20px 60px rgba(0,0,0,0.40),
    0 1px 0 rgba(99,102,241,0.12) inset;
}

/* ===== Logo glow ring ===== */
.site-loader-ring-outer {
  position: relative;
  width: 112px;
  height: 112px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}
.site-loader-ring-inner {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 2px solid transparent;
  background: conic-gradient(from 0deg, var(--theme-primary, #6366f1), var(--theme-gold, #D4A017), #8b5cf6, var(--theme-primary, #6366f1));
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  animation: sl-ring-spin 3s linear infinite;
  opacity: 0.7;
}

/* ===== Logo container ===== */
.site-loader-logo {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  animation: sl-logo-in 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s both,
             sl-breathe 2.4s ease-in-out 1s infinite;
  box-shadow: 0 10px 30px rgba(212,160,23,0.30);
}
.site-loader-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 6px;
}
.site-loader-flame {
  width: 36px;
  height: 36px;
  color: #fff;
  filter: drop-shadow(0 2px 8px rgba(255,255,255,0.3));
}

/* ===== Site name ===== */
.site-loader-name {
  margin: 0 0 4px;
  font-size: clamp(1.25rem, 4vw, 1.75rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #1e293b;
  animation: sl-text-up 0.6s ease-out 0.35s both;
}
html.dark .site-loader-name {
  color: #f1f5f9;
}

/* ===== Tagline ===== */
.site-loader-tagline {
  margin: 0 0 28px;
  font-size: clamp(0.7rem, 2.5vw, 0.85rem);
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--theme-gold, #D4A017);
  animation: sl-text-up 0.6s ease-out 0.5s both;
}
html.dark .site-loader-tagline {
  color: var(--theme-gold, #D4A017);
}

/* ===== 3-dot loading indicator ===== */
.site-loader-dots {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}
.site-loader-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6366f1;
  opacity: 0.4;
  animation: sl-dot-pulse 1.4s ease-in-out infinite;
}
.site-loader-dots span:nth-child(1) { animation-delay: 0s; }
.site-loader-dots span:nth-child(2) { animation-delay: 0.2s; }
.site-loader-dots span:nth-child(3) { animation-delay: 0.4s; }
html.dark .site-loader-dots span {
  background: #818cf8;
}

/* ===== Shimmer progress bar ===== */
.site-loader-bar {
  width: 180px;
  height: 4px;
  border-radius: 999px;
  background: rgba(15,23,42,0.08);
  overflow: hidden;
}
html.dark .site-loader-bar {
  background: rgba(255,255,255,0.08);
}
.site-loader-bar-fill {
  width: 40%;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--theme-primary, #6366f1), var(--theme-gold, #D4A017), #8b5cf6);
  animation: sl-bar-slide 1.8s ease-in-out infinite;
}

/* ===== Keyframes ===== */
@keyframes sl-card-in {
  from { opacity: 0; transform: translateY(20px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
}
@keyframes sl-logo-in {
  from { opacity: 0; transform: scale(0.5) rotate(-12deg); }
  to   { opacity: 1; transform: scale(1)   rotate(0);      }
}
@keyframes sl-breathe {
  0%, 100% { transform: scale(1);    box-shadow: 0 10px 30px rgba(212,160,23,0.30); }
  50%      { transform: scale(1.06); box-shadow: 0 14px 44px rgba(212,160,23,0.45); }
}
@keyframes sl-ring-spin {
  to { transform: rotate(360deg); }
}
@keyframes sl-text-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes sl-dot-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50%      { opacity: 1;   transform: scale(1.2); }
}
@keyframes sl-dot-bounce {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50%      { opacity: 1;   transform: translateY(-4px); }
}
@keyframes sl-bar-slide {
  0%   { transform: translateX(-100%); width: 30%; }
  50%  { width: 60%; }
  100% { transform: translateX(350%); width: 40%; }
}
@keyframes sl-drift {
  0%, 100% { transform: translate(0, 0)         scale(1);   }
  33%      { transform: translate(40px, -30px)  scale(1.1); }
  66%      { transform: translate(-30px, 25px)  scale(0.95); }
}

/* ===== Responsive: compact on mobile ===== */
@media (max-width: 480px) {
  .site-loader-card {
    padding: 36px 32px 28px;
    border-radius: 22px;
  }
  .site-loader-ring-outer {
    width: 92px;
    height: 92px;
    margin-bottom: 18px;
  }
  .site-loader-logo {
    width: 64px;
    height: 64px;
  }
  .site-loader-flame {
    width: 28px;
    height: 28px;
  }
  .site-loader-bar {
    width: 140px;
  }
}

/* ===== Reduced motion ===== */
@media (prefers-reduced-motion: reduce) {
  .site-loader-blob,
  .site-loader-ring-inner,
  .site-loader-logo,
  .site-loader-bar-fill,
  .site-loader-dots span,
  .site-loader-minimal .site-loader-orb,
  .site-loader-minimal .site-loader-dots i {
    animation: none !important;
  }
}
`;

// Inject the CSS once after the constant is defined (see injectCSS above).
injectCSS();

export default SiteLoader;
