/**
 * TermsPage — public terms & conditions (route: /terms)
 *
 * Layout: hero → sticky table of contents (scroll-spy) → term sections → contact.
 * Self-contained; uses the .pw-* tokens defined in PublicShell.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale, FileText, Phone, MapPin, ArrowRight, ChevronRight } from 'lucide-react';
import PublicShell from './PublicShell';

const SECTIONS = [
  {
    id: 'acceptance', title: 'Acceptance of terms',
    body: (
      <p>By placing an order through our website or app, you agree to these Terms &amp; Conditions.
         If you do not agree, please do not use our Service.</p>
    ),
  },
  {
    id: 'ordering', title: 'Ordering',
    body: (
      <>
        <p>Orders placed through the Service are offers to purchase. We reserve the right to refuse or
           cancel any order at our discretion — for example, if items are unavailable or we suspect
           fraudulent activity.</p>
        <p>Menu prices are shown in Bhutanese Ngultrum (Nu.) and include applicable taxes and service
           charges as displayed at checkout.</p>
      </>
    ),
  },
  {
    id: 'delivery', title: 'Delivery',
    body: (
      <ul>
        <li>We deliver within Thimphu and selected nearby areas.</li>
        <li>Delivery times are estimates — traffic, weather, and order volume can affect them.</li>
        <li>Free delivery applies to orders of 3 or more packs (Tomza or equivalent). Otherwise a delivery fee applies.</li>
        <li>You are responsible for ensuring someone is available at the delivery address to receive the order.</li>
      </ul>
    ),
  },
  {
    id: 'payment', title: 'Payment',
    body: (
      <p>We accept cash on delivery and online payment methods as offered at checkout. Prices are final
         at the time of order placement.</p>
    ),
  },
  {
    id: 'cancellations', title: 'Cancellations & refunds',
    body: (
      <>
        <p>Orders may be cancelled within 5 minutes of placement — call us immediately. After preparation
           has started, cancellations are not accepted.</p>
        <p>Refunds are issued if: (a) we cannot fulfil your order, (b) the food is incorrect, or (c) the
           food is unacceptable quality. Refund requests must be made within 1 hour of delivery.</p>
      </>
    ),
  },
  {
    id: 'allergies', title: 'Allergies & dietary requirements',
    body: (
      <p>We handle allergens in our kitchen and cannot guarantee a completely allergen-free environment.
         Please call us directly before ordering if you have severe allergies.</p>
    ),
  },
  {
    id: 'ip', title: 'Intellectual property',
    body: (
      <p>All content on this website — text, images, logos, and the application — is owned by us and
         protected by copyright. You may not reproduce it without written permission.</p>
    ),
  },
  {
    id: 'liability', title: 'Limitation of liability',
    body: (
      <p>To the maximum extent permitted by Bhutanese law, we are not liable for indirect, incidental, or
         consequential damages arising from your use of the Service.</p>
    ),
  },
  {
    id: 'law', title: 'Governing law',
    body: (
      <p>These terms are governed by the laws of the Kingdom of Bhutan. Any disputes shall be resolved in
         the courts of Thimphu.</p>
    ),
  },
  {
    id: 'changes', title: 'Changes to terms',
    body: (
      <p>We may update these terms at any time. Continued use of the Service after changes constitutes
         acceptance of the new terms.</p>
    ),
  },
  {
    id: 'contact', title: 'Contact',
    body: (
      <p>Questions about these terms? Call us on{' '}
        <a href="tel:+97577467538">+975 77467538</a> or visit us at Norzin Lam 1, opposite the
        Thimphu Thromde Office (near the Clock Tower).</p>
    ),
  },
];

const TermsPage = () => {
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
    <PublicShell active="terms">

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: 'var(--pw-bg)' }}>
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background:
            'radial-gradient(560px 320px at 12% 0%,rgba(245,158,11,0.11),transparent 70%),' +
            'radial-gradient(520px 320px at 88% 20%,rgba(251,146,60,0.08),transparent 70%)',
        }} />
        <span aria-hidden="true" className="pw-fx-orb pw-fx-orb-b"
              style={{ width: 300, height: 300, top: '-10%', left: '-3%', background: 'rgba(245,158,11,0.12)' }} />
        <div className="pw-container relative px-4 sm:px-6 lg:px-8 pt-12 pb-10 sm:pt-16 sm:pb-12">
          <div className="flex items-start gap-4">
            <span className="hidden sm:flex w-14 h-14 rounded-2xl items-center justify-center shrink-0"
                  style={{ background: 'var(--pw-grad)', color: 'var(--pw-ink-on-accent)' }} aria-hidden="true">
              <Scale size={26} />
            </span>
            <div className="min-w-0">
              <p className="pw-eyebrow mb-4">
                <FileText size={12} aria-hidden="true" /> Legal
              </p>
              <h1 className="pw-ink font-extrabold leading-[1.06]"
                  style={{ fontSize: 'clamp(30px,4.6vw,50px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
                Terms <span className="pw-muted">&amp;</span>{' '}
                <span className="pw-fx-shimmer" style={{
                  background: 'linear-gradient(90deg,#D9480F,#C2410C 40%,#F97316 55%,#9A3412)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  Conditions
                </span>
              </h1>
              <p className="pw-muted text-[14px] mt-3">Last updated: October 2026 · 11 sections · ~4 min read</p>
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
                    <a href={`#${s.id}`} className={`lg-toc-link ${activeId === s.id ? 'is-active' : ''}`}>
                      <span className="tabular-nums opacity-60">{String(i + 1).padStart(2, '0')}</span>
                      <span className="truncate">{s.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
              <div className="mt-6 p-4 rounded-2xl" style={{ background: 'var(--pw-panel)', border: '1px solid var(--pw-line)' }}>
                <p className="pw-muted text-[12.5px] leading-relaxed">
                  Prefer to read about how we handle data instead?
                </p>
                <Link to="/privacy" className="lg-inline-link mt-2 inline-flex items-center gap-1">
                  Read our Privacy Policy <ArrowRight size={13} aria-hidden="true" />
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

export default TermsPage;
