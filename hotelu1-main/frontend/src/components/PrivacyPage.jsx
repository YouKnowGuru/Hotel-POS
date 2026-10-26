/**
 * PrivacyPage — public privacy policy (route: /privacy)
 *
 * Layout: hero → sticky table of contents (scroll-spy) → policy sections → contact.
 * Self-contained; uses the .pw-* tokens defined in PublicShell.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, FileText, Phone, MapPin, ArrowRight, ChevronRight } from 'lucide-react';
import PublicShell from './PublicShell';

const SECTIONS = [
  {
    id: 'who', title: 'Who we are',
    body: (
      <p>We are a restaurant operating from Thimphu, Bhutan, offering online food delivery services
         through this platform (the "Service").</p>
    ),
  },
  {
    id: 'collect', title: 'Information we collect',
    body: (
      <>
        <p>When you place an order, we collect:</p>
        <ul>
          <li>Your name and delivery address</li>
          <li>Phone number (to confirm delivery) and, if provided, your email for order updates</li>
          <li>Order details and payment method</li>
          <li>For online payments: a screenshot of your payment transfer, uploaded by you so our staff can verify it</li>
        </ul>
      </>
    ),
  },
  {
    id: 'use', title: 'How we use your information',
    body: (
      <>
        <p>We use your information to:</p>
        <ul>
          <li>Process and deliver your orders</li>
          <li>Verify your payments when you pay by bank QR transfer</li>
          <li>Contact you with order updates by phone or email</li>
          <li>Keep accurate business records for tax and accounting</li>
        </ul>
      </>
    ),
  },
  {
    id: 'sharing', title: 'Data sharing',
    body: (
      <>
        <p>We do <strong>not</strong> sell, rent, or trade your personal information to third parties.
           We may share data with:</p>
        <ul>
          <li>Delivery partners (name and address only)</li>
          <li>Payment processors (for billing purposes)</li>
          <li>Authorities if required by Bhutanese law</li>
        </ul>
      </>
    ),
  },
  {
    id: 'retention', title: 'Data retention',
    body: (
      <p>Order data is retained for up to 2 years for accounting and legal compliance. Payment
         screenshots are stored only for as long as your payment needs to be verified and reconciled,
         then deleted. You may request deletion of your personal data at any time by contacting us.</p>
    ),
  },
  {
    id: 'cookies', title: 'Cookies & device storage',
    body: (
      <p>We don't use advertising or third-party analytics cookies. Instead, the app stores a few
         small entries in your browser's local storage — only so it can keep track of the orders YOU
         placed and pending payments on this device. Deleting your browser data removes them; nothing
         of yours is shared with other people who open the site.</p>
    ),
  },
  {
    id: 'security', title: 'Security',
    body: (
      <p>We implement industry-standard security practices including encrypted connections (HTTPS) and
         secure database storage. No system is 100% secure — if you have concerns, please contact us.</p>
    ),
  },
  {
    id: 'rights', title: 'Your rights',
    body: (
      <>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Withdraw consent for marketing communications</li>
        </ul>
      </>
    ),
  },
  {
    id: 'contact', title: 'Contact',
    body: (
      <p>For privacy-related queries, call us on{' '}
        <a href="tel:+97577467538">+975 77467538</a> or visit us at Norzin Lam 1, opposite the
        Thimphu Thromde Office (near the Clock Tower).</p>
    ),
  },
];

const PrivacyPage = () => {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);

  /* Scroll-spy for the table of contents */
  useEffect(() => {
    const els = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean);
    if (!els.length || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveId(visible[0].target.id);
    }, { rootMargin: '-140px 0px -55% 0px', threshold: 0 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <PublicShell active="privacy">

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: 'var(--pw-bg)' }}>
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background:
            'radial-gradient(560px 320px at 12% 0%,rgba(245,158,11,0.11),transparent 70%),' +
            'radial-gradient(520px 320px at 88% 20%,rgba(251,146,60,0.08),transparent 70%)',
        }} />
        <span aria-hidden="true" className="pw-fx-orb pw-fx-orb-a"
              style={{ width: 300, height: 300, top: '-10%', right: '-3%', background: 'rgba(99,102,241,0.13)' }} />
        <div className="pw-container relative px-4 sm:px-6 lg:px-8 pt-12 pb-10 sm:pt-16 sm:pb-12">
          <div className="flex items-start gap-4">
            <span className="hidden sm:flex w-14 h-14 rounded-2xl items-center justify-center shrink-0"
                  style={{ background: 'var(--pw-grad)', color: 'var(--pw-ink-on-accent)' }} aria-hidden="true">
              <ShieldCheck size={26} />
            </span>
            <div className="min-w-0">
              <p className="pw-eyebrow mb-4">
                <FileText size={12} aria-hidden="true" /> Legal
              </p>
              <h1 className="pw-ink font-extrabold leading-[1.06]"
                  style={{ fontSize: 'clamp(30px,4.6vw,50px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
                Privacy{' '}
                <span className="pw-fx-shimmer" style={{
                  background: 'linear-gradient(90deg,#D9480F,#C2410C 40%,#F97316 55%,#9A3412)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  Policy
                </span>
              </h1>
              <p className="pw-muted text-[14px] mt-3">Last updated: October 2026 · 9 sections · ~3 min read</p>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="pb-16 sm:pb-24" style={{ background: 'var(--pw-bg)' }}>
        <div className="pw-container px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[248px_minmax(0,1fr)] gap-6 lg:gap-10 items-start">

            {/* Table of contents — desktop */}
            <nav aria-label="Table of contents" className="hidden lg:block sticky" style={{ top: 96 }}>
              <p className="pw-footer-title">On this page</p>
              <ol className="space-y-1">
                {SECTIONS.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}
                       className={`lg-toc-link ${activeId === s.id ? 'is-active' : ''}`}>
                      <span className="tabular-nums opacity-60">{String(i + 1).padStart(2, '0')}</span>
                      <span className="truncate">{s.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
              <div className="mt-6 p-4 rounded-2xl" style={{ background: 'var(--pw-panel)', border: '1px solid var(--pw-line)' }}>
                <p className="pw-muted text-[12.5px] leading-relaxed">
                  Questions about your data? We usually reply within one business day.
                </p>
                <Link to="/terms" className="lg-inline-link mt-2 inline-flex items-center gap-1">
                  Read our Terms <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
            </nav>

            {/* Table of contents — mobile */}
            <details className="lg:hidden pw-card p-4">
              <summary className="pw-ink font-bold text-[14.5px] cursor-pointer list-none flex items-center justify-between gap-2 min-h-[40px]">
                On this page
                <ChevronRight size={16} style={{ color: '#C2410C' }} aria-hidden="true" />
              </summary>
              <ol className="mt-3 space-y-1">
                {SECTIONS.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className={`lg-toc-link ${activeId === s.id ? 'is-active' : ''}`}>
                      <span className="tabular-nums opacity-60">{String(i + 1).padStart(2, '0')}</span>
                      <span className="truncate">{s.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </details>

            {/* Content */}
            <article className="pw-card p-5 sm:p-8 lg:p-10 min-w-0">
              {SECTIONS.map((s, i) => (
                <section key={s.id} id={s.id} className="lg-section" style={{ scrollMarginTop: 110 }}>
                  <div className="flex items-baseline gap-3">
                    <span className="tabular-nums text-[13px] font-black shrink-0" style={{ color: '#C2410C' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h2 className="pw-ink font-bold text-[19px] sm:text-[21px] leading-snug">{s.title}</h2>
                  </div>
                  <div className="lg-body mt-3">{s.body}</div>
                </section>
              ))}
            </article>
          </div>

          {/* Contact strip */}
          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <a href="tel:+97577467538" className="pw-card pw-fx-sheen p-5 flex items-center gap-4">
              <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(96,165,250,0.14)', color: '#2563EB' }} aria-hidden="true">
                <Phone size={19} />
              </span>
              <span className="min-w-0">
                <span className="block pw-muted text-[12px] font-bold uppercase tracking-wider">Call us</span>
                <span className="block pw-ink font-semibold text-[14.5px] break-words">+975 77467538</span>
              </span>
            </a>
            <a href="#" className="pw-card pw-fx-sheen p-5 flex items-center gap-4">
              <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(248,113,113,0.14)', color: '#DC2626' }} aria-hidden="true">
                <MapPin size={19} />
              </span>
              <span className="min-w-0">
                <span className="block pw-muted text-[12px] font-bold uppercase tracking-wider">Visit us</span>
                <span className="block pw-ink font-semibold text-[14.5px]">Norzin Lam 1, Thimphu</span>
              </span>
            </a>
          </div>
        </div>
      </section>

      <style>{`
        .lg-toc-link{
          display:flex;align-items:center;gap:8px;min-height:38px;padding:7px 12px;border-radius:10px;
          font-size:13.5px;font-weight:600;color:#7A6553;text-decoration:none;
          border-left:2px solid transparent;transition:all .2s var(--pw-ease);
        }
        .lg-toc-link:hover{ color:#221207;background:rgba(63,32,4,0.05); }
        .lg-toc-link.is-active{
          color:#C2410C;background:rgba(234,88,12,0.1);
          border-left-color:#F59E0B;font-weight:800;
        }
        .lg-inline-link{ color:#C2410C;font-size:13px;font-weight:700;text-decoration:none; }
        .lg-inline-link:hover{ text-decoration:underline; }
        .lg-section + .lg-section{ margin-top:34px;padding-top:34px;border-top:1px solid var(--pw-line); }
        .lg-body{ color:#5C4B3A;font-size:15px;line-height:1.75; }
        .lg-body p{ margin:0 0 12px; }
        .lg-body p:last-child{ margin-bottom:0; }
        .lg-body ul{ margin:0 0 12px;padding-left:1.15rem;list-style:disc; }
        .lg-body li{ margin-bottom:7px; }
        .lg-body li::marker{ color:#F59E0B; }
        .lg-body strong{ color:#221207;font-weight:700; }
        .lg-body a{ color:#C2410C;font-weight:600;text-decoration:underline;text-underline-offset:3px; }
        .lg-body a:hover{ color:#9A3412; }
        details > summary::-webkit-details-marker{ display:none; }
      `}</style>
    </PublicShell>
  );
};

export default PrivacyPage;
