/**
 * AboutPage — public "our story" page (route: /about)
 *
 * Sections: hero → values → story + facts → numbers → contact → CTA
 * All surfaces use the .pw-* design tokens defined in PublicShell.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Award, Users, Utensils, Heart, MapPin, Phone,
  ChevronRight, Sparkles, Flame, ArrowRight,
} from 'lucide-react';
import PublicShell from './PublicShell';

const FACTS = [
  { label: 'Specialty',   val: 'Tomza' },
  { label: 'Location',    val: 'Norzin Lam 1, Thimphu' },
  { label: 'Hours',       val: '10 AM – 9 PM daily' },
  { label: 'Price range', val: 'BTN 200 – 1,000' },
];

const TEAM = [
  { name: 'Tashi Chezom', role: 'Owner & Head of Kitchen', blurb: 'The name behind Paradise Tomza — serving authentic banana-leaf wrapped tomza with suja and daw on Norzin Lam 1.' },
];

const VALUES = [
  { icon: <Utensils size={24} />, title: 'Fresh ingredients', desc: 'We source locally and cook fresh every day — no frozen shortcuts.' },
  { icon: <Heart    size={24} />, title: 'Made with love',    desc: 'Every dish is prepared by our experienced kitchen team with genuine care.' },
  { icon: <Award    size={24} />, title: 'Proven quality',    desc: 'Rated 4.5★ by 40+ Google reviewers across Thimphu.' },
  { icon: <Users    size={24} />, title: 'Community first',   desc: 'We support local farmers and employ our neighbours — giving back always.' },
];

const CONTACT = [
  { icon: <Phone size={22} />,  label: '+975 77467538', href: 'tel:+97577467538', hint: 'Call to order' },
  { icon: <MapPin size={22} />, label: 'Norzin Lam 1, opposite Thimphu Thromde Office, near Clock Tower', href: '#', hint: 'Our kitchen' },
];

const AboutPage = () => (
  <PublicShell active="about">

    {/* ════════════════════ HERO ════════════════════ */}
    <section className="relative overflow-hidden" style={{ background: 'var(--pw-bg)' }}>
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background:
          'radial-gradient(620px 360px at 15% 0%,rgba(245,158,11,0.12),transparent 70%),' +
          'radial-gradient(560px 340px at 90% 30%,rgba(234,88,12,0.09),transparent 70%),' +
          'radial-gradient(600px 400px at 50% 110%,rgba(251,146,60,0.07),transparent 70%)',
      }} />
      <div aria-hidden="true" className="ab-grid" />

      <div className="pw-container relative px-4 sm:px-6 lg:px-8 pt-12 pb-14 sm:pt-16 sm:pb-20">
        <div className="max-w-3xl">
          <p className="pw-eyebrow mb-5">
            <Sparkles size={12} aria-hidden="true" /> Our story
          </p>
          <h1 className="pw-ink font-extrabold leading-[1.05] mb-6"
              style={{ fontSize: 'clamp(32px,5.2vw,60px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
            Food made with love,
            <span className="block pw-fx-shimmer" style={{
              background: 'linear-gradient(90deg,#D9480F,#C2410C 40%,#F97316 55%,#9A3412)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              delivered with care.
            </span>
          </h1>
          <p className="pw-sub leading-relaxed" style={{ fontSize: 'clamp(15px,1.6vw,18px)', maxWidth: '42rem' }}>
            We're Thimphu's home of authentic tomza — a complete Bhutanese meal wrapped inside a fresh
            banana leaf, served alongside hot butter tea (suja) and sour buttermilk (daw). From our kitchen
            on Norzin Lam 1, opposite the Thromde office, we serve traditional favourites — fast, hot, and
            straight to your door.
          </p>

          <ul className="flex flex-wrap gap-2.5 mt-7">
            {FACTS.map(({ label, val }) => (
              <li key={label} className="pw-chip">
                <span className="pw-ink font-extrabold">{val}</span>
                <span className="pw-muted">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <style>{`.ab-grid{position:absolute;inset:0;pointer-events:none;
        background-image:radial-gradient(rgba(63,32,4,0.12) 1px,transparent 1px);
        background-size:34px 34px;
        -webkit-mask-image:radial-gradient(65% 60% at 50% 35%,#000 0%,transparent 100%);
        mask-image:radial-gradient(65% 60% at 50% 35%,#000 0%,transparent 100%);}`}</style>
    </section>

    {/* ════════════════════ VALUES ════════════════════ */}
    <section className="py-14 sm:py-20" style={{ background: 'var(--pw-bg-2)' }}>
      <div className="pw-container px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-10 sm:mb-14 pw-reveal">
          <p className="pw-eyebrow mb-4">What we stand for</p>
          <h2 className="pw-ink font-extrabold leading-[1.1]"
              style={{ fontSize: 'clamp(26px,3.8vw,42px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
            Four promises we keep, every single order
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {VALUES.map(({ icon, title, desc }, i) => (
            <article key={title} className="pw-card p-6 flex flex-col pw-reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                    style={{ background: 'rgba(234,88,12,0.09)', border: '1px solid rgba(234,88,12,0.25)', color: '#C2410C' }}
                    aria-hidden="true">
                {icon}
              </span>
              <h3 className="pw-ink font-bold text-[17px] mb-2">{title}</h3>
              <p className="pw-muted text-[14px] leading-relaxed">{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    {/* ════════════════════ STORY ════════════════════ */}
    <section className="py-14 sm:py-20" style={{ background: 'var(--pw-bg)' }}>
      <div className="pw-container px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 xl:gap-14 items-center">
          <div className="pw-reveal">
            <p className="pw-eyebrow mb-4">How it started</p>
            <h2 className="pw-ink font-extrabold leading-[1.1] mb-5"
                style={{ fontSize: 'clamp(26px,3.8vw,42px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
              A travel meal for farmers, now on Norzin Lam
            </h2>
            <p className="pw-sub leading-relaxed mb-4">
              Tomza is a traditional Bhutanese packed lunch — a complete meal wrapped inside a fresh
              banana leaf. Born as a convenient travel meal for farmers and travellers, this local
              “thali-on-the-go” packs the essentials of a Bhutanese meal: a generous bed of red rice,
              a spicy <em style={{ color: '#C2410C', fontStyle: 'italic' }}>paa</em> (Sikam or Shakam),
              Ema Datshi or saag, a boiled egg and fiery ezay.
            </p>
            <p className="pw-sub leading-relaxed mb-7">
              Paradise Tomza, run by Ms. Tashi Chezom, is the best-known informal spot in Thimphu
              serving this classic — alongside hot, salty butter tea (suja) and local sour buttermilk
              (daw), just as it is traditionally enjoyed.
            </p>
            <Link to="/order" className="pw-btn-primary">
              Try our food today <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </div>

          <div className="pw-card overflow-hidden pw-reveal" style={{ transitionDelay: '100ms' }}>
            <div className="p-6 sm:p-7" style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.16),rgba(234,88,12,0.08))' }}>
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: 'var(--pw-grad)', color: 'var(--pw-ink-on-accent)' }} aria-hidden="true">
                  <Flame size={22} />
                </span>
                <div>
                  <p className="pw-ink font-extrabold text-[17px] leading-tight">The kitchen, in numbers</p>
                  <p className="pw-muted text-[13px]">Updated every service</p>
                </div>
              </div>
            </div>
            <dl className="divide-y" style={{ borderColor: 'var(--pw-line)' }}>
              {FACTS.map(({ label, val }) => (
                <div key={label} className="flex justify-between items-center gap-4 px-6 sm:px-7 py-4">
                  <dt className="pw-muted text-[14px]">{label}</dt>
                  <dd className="pw-ink font-extrabold tabular-nums">{val}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>

    {/* ════════════════════ TEAM ════════════════════ */}
    <section className="py-14 sm:py-20 overflow-hidden" style={{ background: 'var(--pw-bg)' }}>
      {/* ambient orbs */}
      <span aria-hidden="true" className="pw-fx-orb pw-fx-orb-a"
            style={{ width: 280, height: 280, top: '4%', right: '-4%', background: 'rgba(245,158,11,0.10)' }} />
      <span aria-hidden="true" className="pw-fx-orb pw-fx-orb-b"
            style={{ width: 260, height: 260, bottom: '0%', left: '-4%', background: 'rgba(99,102,241,0.10)' }} />

      <div className="pw-container relative px-4 sm:px-6 lg:px-8">          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 pw-reveal">
          <p className="pw-eyebrow mb-4">
            <Users size={12} aria-hidden="true" /> The people behind your plate
          </p>
          <h2 className="pw-ink font-extrabold leading-[1.1]"
              style={{ fontSize: 'clamp(26px,3.8vw,42px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
            Meet the team
          </h2>
          <p className="pw-muted mt-4 text-[15px]">
            Small team, one obsession: authentic tomza, wrapped fresh every day.
          </p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-lg mx-auto">
          {TEAM.map((member, i) => (
            <li key={member.name}
                className="pw-card p-5 sm:p-6 text-center pw-reveal pw-fx-tilt"
                style={{ transitionDelay: `${i * 90}ms` }}>
              <span
                className={`w-[76px] h-[76px] mx-auto rounded-full flex items-center justify-center text-2xl font-black mb-4 ${i % 2 ? 'pw-fx-float-b' : 'pw-fx-float'}`}
                style={{
                  background: 'linear-gradient(135deg,#F59E0B,#EA580C)',
                  color: '#1B0F02',
                  boxShadow: '0 14px 34px -12px rgba(245,158,11,0.8)',
                }}
                aria-hidden="true">
                {member.name.charAt(0)}
              </span>
              <h3 className="pw-ink font-bold text-[15.5px]">{member.name}</h3>
              <p className="text-[11px] font-extrabold uppercase tracking-wider mt-1 mb-2" style={{ color: '#C2410C' }}>
                {member.role}
              </p>
              <p className="pw-muted text-[13px] leading-relaxed">{member.blurb}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>

    {/* ════════════════════ CONTACT ════════════════════ */}
    <section className="py-14 sm:py-20" style={{ background: 'var(--pw-bg-2)' }}>
      <div className="pw-container px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 pw-reveal">
          <p className="pw-eyebrow mb-4">Say hello</p>
          <h2 className="pw-ink font-extrabold leading-[1.1]"
              style={{ fontSize: 'clamp(26px,3.8vw,42px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
            Get in touch
          </h2>
          <p className="pw-muted mt-4 text-[15px]">
            Feedback, a bulk order, or just saying hi — we'd love to hear from you.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 sm:gap-5 max-w-4xl mx-auto">
          {CONTACT.map(({ icon, label, href, hint }, i) => (
            <a key={label} href={href}
               className="pw-card flex flex-col items-center gap-3 p-6 text-center pw-reveal"
               style={{ transitionDelay: `${i * 80}ms`, textDecoration: 'none' }}>
              <span className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(234,88,12,0.09)', color: '#C2410C' }} aria-hidden="true">
                {icon}
              </span>
              <span className="block">
                <span className="block pw-muted text-[12px] font-bold uppercase tracking-wider mb-1">{hint}</span>
                <span className="block pw-ink font-semibold text-[14.5px] break-words">{label}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>

    {/* ════════════════════ CTA ════════════════════ */}
    <section className="py-14 sm:py-20" style={{ background: 'var(--pw-bg)' }}>
      <div className="pw-container px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl px-6 py-10 sm:px-12 sm:py-14 text-center pw-reveal"
             style={{ background: 'var(--pw-grad)', color: 'var(--pw-ink-on-accent)' }}>
          <div aria-hidden="true" style={{
            position: 'absolute', inset: 0, opacity: 0.35, pointerEvents: 'none',
            background: 'radial-gradient(360px 180px at 20% 0%,rgba(255,255,255,0.55),transparent 70%)',
          }} />
          <div className="relative max-w-2xl mx-auto">
            <h2 className="font-extrabold leading-[1.08] mb-4"
                style={{ fontSize: 'clamp(26px,4vw,42px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
              Hungry? Taste the story for yourself.
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/order"
                    className="inline-flex items-center justify-center gap-2 min-h-[50px] px-7 rounded-2xl font-extrabold text-[15px] transition-transform hover:-translate-y-0.5"
                    style={{ background: '#120A02', color: '#FFF7EC' }}>
                Order online <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link to="/"
                    className="inline-flex items-center justify-center gap-2 min-h-[50px] px-7 rounded-2xl font-extrabold text-[15px] transition-transform hover:-translate-y-0.5"
                    style={{ background: 'rgba(255,255,255,0.28)', border: '1.5px solid rgba(27,15,2,0.35)' }}>
                See today's menu
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>

  </PublicShell>
);

export default AboutPage;
