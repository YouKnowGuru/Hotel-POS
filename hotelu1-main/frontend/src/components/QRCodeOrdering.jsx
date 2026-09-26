import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UtensilsCrossed, Sparkles } from 'lucide-react';
import SimpleMenu from './SimpleMenu';
import CustomerOrderTracker from './CustomerOrderTracker';
import Notification from './Notification';
import { loadBranding, fetchBrandingFromServer } from '../utils/branding';
import useCurrency from '../hooks/useCurrency';
import { Flame } from 'lucide-react';

/* ─── Timing ────────────────────────────────────────────────────── */
const SPLASH_MS = 3200;

/* ─── Food particles: emoji + orbit radius + speed + start angle ── */
const FOOD_PARTICLES = [
  { emoji: '🍽️', r: 150, speed: 18, a: 0,   size: 26 },
  { emoji: '🥗',  r: 170, speed: 24, a: 72,  size: 22 },
  { emoji: '🍜',  r: 145, speed: 20, a: 144, size: 24 },
  { emoji: '☕',  r: 165, speed: 22, a: 216, size: 22 },
  { emoji: '🍰',  r: 155, speed: 26, a: 288, size: 23 },
];

/* ─── Keyframes ─────────────────────────────────────────────────── */
const SPLASH_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display+SC:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');

  @keyframes splashIn     { from{opacity:0} to{opacity:1} }
  @keyframes splashOut    { from{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(1.06)} }
  @keyframes menuIn       { from{opacity:0} to{opacity:1} }

  @keyframes logoEntry    { 0%{opacity:0;transform:scale(0.4) rotate(-15deg)}
                            60%{opacity:1;transform:scale(1.1) rotate(4deg)}
                            80%{transform:scale(0.97) rotate(-1deg)}
                            100%{opacity:1;transform:scale(1) rotate(0deg)} }

  @keyframes ringPulse    { 0%{transform:scale(0.85);opacity:0}
                            30%{opacity:1}
                            100%{transform:scale(1.6);opacity:0} }

  @keyframes nameSlideUp  { from{opacity:0;transform:translateY(28px) skewY(2deg)}
                            to{opacity:1;transform:translateY(0) skewY(0)} }

  @keyframes tagSlide     { from{opacity:0;transform:translateY(16px)}
                            to{opacity:1;transform:translateY(0)} }

  @keyframes cardRise     { from{opacity:0;transform:translateY(40px) scale(0.92)}
                            to{opacity:1;transform:translateY(0) scale(1)} }

  @keyframes welcomeIn    { from{opacity:0;transform:translateY(10px)}
                            to{opacity:1;transform:translateY(0)} }

  @keyframes orbDrift     { 0%,100%{transform:translate(0,0) scale(1)}
                            33%{transform:translate(14px,-18px) scale(1.04)}
                            66%{transform:translate(-10px,12px) scale(0.97)} }

  @keyframes orbit0       { from{transform:rotate(0deg)   translateX(150px) rotate(0deg)}    to{transform:rotate(360deg)  translateX(150px) rotate(-360deg)} }
  @keyframes orbit1       { from{transform:rotate(72deg)  translateX(170px) rotate(-72deg)}  to{transform:rotate(432deg)  translateX(170px) rotate(-432deg)} }
  @keyframes orbit2       { from{transform:rotate(144deg) translateX(145px) rotate(-144deg)} to{transform:rotate(504deg)  translateX(145px) rotate(-504deg)} }
  @keyframes orbit3       { from{transform:rotate(216deg) translateX(165px) rotate(-216deg)} to{transform:rotate(576deg)  translateX(165px) rotate(-576deg)} }
  @keyframes orbit4       { from{transform:rotate(288deg) translateX(155px) rotate(-288deg)} to{transform:rotate(648deg)  translateX(155px) rotate(-648deg)} }

  @keyframes shimBar      { from{transform:translateX(-100%)} to{transform:translateX(300%)} }
  @keyframes dotBlink     { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
  @keyframes glowPulse    { 0%,100%{box-shadow:0 0 40px rgba(212,160,23,0.35),0 0 80px rgba(212,160,23,0.1)}
                            50%{box-shadow:0 0 60px rgba(212,160,23,0.6),0 0 120px rgba(212,160,23,0.2)} }
  @keyframes tapHint      { 0%,100%{opacity:0.4;transform:translateY(0)} 50%{opacity:0.75;transform:translateY(-4px)} }
  @keyframes noiseMove    { from{transform:translate(0,0)} to{transform:translate(-64px,-64px)} }

  .qr-splash-exit { animation: splashOut 0.65s cubic-bezier(0.4,0,1,1) forwards !important; }
  .qr-menu-enter  { animation: menuIn 0.4s ease-out both; }
  @keyframes menuIn { from{opacity:0} to{opacity:1} }
`;

/* ─── SVG noise texture (subtle film grain) ─────────────────────── */
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='128' height='128' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E")`;

/* ─── Concentric pulsing ring ────────────────────────────────────── */
function Ring({ delay, size, color }) {
  return (
    <div style={{
      position: 'absolute', width: size, height: size,
      borderRadius: '50%',
      border: `1.5px solid ${color}`,
      animation: `ringPulse 2.8s ease-out ${delay}s infinite`,
      pointerEvents: 'none',
    }} />
  );
}

/* ─── Welcome Splash ─────────────────────────────────────────────── */
function WelcomeSplash({ branding, tableLabel, isTakeaway, onDone }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase]       = useState(0); // staggered reveal phases
  const [exiting, setExiting]   = useState(false);
  const rafRef   = useRef(null);
  const startRef = useRef(null);

  /* ── Progress + phase timer ── */
  useEffect(() => {
    const phases = [200, 600, 950, 1200, 1500];
    let phaseIdx = 0;
    const phaseTimers = phases.map((ms, i) =>
      setTimeout(() => setPhase(i + 1), ms)
    );

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      setProgress(Math.min(elapsed / SPLASH_MS, 1));
      if (elapsed < SPLASH_MS) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        triggerExit();
      }
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      phaseTimers.forEach(clearTimeout);
    };
  }, []);

  const triggerExit = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onDone, 650);
  };

  const logoRadius =
    branding.logoShape === 'circle' ? '50%'
      : branding.logoShape === 'square' ? '12px' : '28px';

  return (
    <div
      className={exiting ? 'qr-splash-exit' : ''}
      onClick={triggerExit}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', cursor: 'pointer',
        animation: 'splashIn 0.5s ease both',
        /* Rich deep dark background */
        background: 'radial-gradient(ellipse 120% 80% at 50% 0%, #1a1040 0%, #0a0f20 55%, #050810 100%)',
      }}
    >
      <style>{SPLASH_CSS}</style>

      {/* ── Film-grain noise overlay ── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: NOISE_SVG,
        backgroundRepeat: 'repeat',
        backgroundSize: '128px 128px',
        opacity: 0.45,
        mixBlendMode: 'overlay',
        animation: 'noiseMove 0.18s steps(1) infinite',
      }} />

      {/* ── Ambient background orbs ── */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0 }}>
        {/* Top-left amber */}
        <div style={{ position:'absolute', top:'-10%', left:'-10%', width:'60vw', height:'60vw', maxWidth:380, maxHeight:380, borderRadius:'50%', background:'radial-gradient(circle,rgba(212,160,23,0.22) 0%,transparent 65%)', animation:'orbDrift 9s ease-in-out infinite', filter:'blur(2px)' }} />
        {/* Bottom-right violet */}
        <div style={{ position:'absolute', bottom:'-12%', right:'-8%', width:'55vw', height:'55vw', maxWidth:340, maxHeight:340, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,0.28) 0%,transparent 65%)', animation:'orbDrift 11s ease-in-out infinite reverse 2s', filter:'blur(2px)' }} />
        {/* Center-left rose */}
        <div style={{ position:'absolute', top:'40%', left:'-15%', width:'45vw', height:'45vw', maxWidth:280, maxHeight:280, borderRadius:'50%', background:'radial-gradient(circle,rgba(244,63,94,0.16) 0%,transparent 65%)', animation:'orbDrift 13s ease-in-out infinite 4s', filter:'blur(2px)' }} />
        {/* Top-right teal */}
        <div style={{ position:'absolute', top:'5%', right:'-12%', width:'40vw', height:'40vw', maxWidth:250, maxHeight:250, borderRadius:'50%', background:'radial-gradient(circle,rgba(20,200,180,0.12) 0%,transparent 65%)', animation:'orbDrift 10s ease-in-out infinite 1s', filter:'blur(2px)' }} />
      </div>

      {/* ── Top gold hairline ── */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent 0%,rgba(212,160,23,0.6) 30%,#F59E0B 50%,rgba(212,160,23,0.6) 70%,transparent 100%)', zIndex:2 }} />

      {/* ── Main centred stack ── */}
      <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'0 32px', maxWidth:400, width:'100%' }}>

        {/* ── Logo + rings ── */}
        <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:32, opacity: phase >= 1 ? 1 : 0, transition:'opacity 0.3s' }}>
          {/* Pulsing concentric rings */}
          {phase >= 1 && <>
            <Ring size={156} color="rgba(212,160,23,0.55)" delay={0} />
            <Ring size={196} color="rgba(212,160,23,0.35)" delay={0.5} />
            <Ring size={240} color="rgba(212,160,23,0.18)" delay={1.0} />
            <Ring size={288} color="rgba(212,160,23,0.08)" delay={1.5} />
          </>}

          {/* Glow disc behind logo */}
          <div style={{
            position:'absolute', width:120, height:120, borderRadius:'50%',
            background:'radial-gradient(circle,rgba(212,160,23,0.45),transparent 70%)',
            animation: phase >= 1 ? 'glowPulse 2.5s ease-in-out infinite' : 'none',
            filter:'blur(4px)',
          }} />

          {/* Logo itself */}
          <div style={{
            position:'relative', width:110, height:110, borderRadius: logoRadius,
            background: branding.logo ? '#fff' : 'linear-gradient(135deg,#E6B800 0%,#A16207 100%)',
            border:'3px solid rgba(212,160,23,0.4)',
            boxShadow:'0 0 0 8px rgba(212,160,23,0.08), 0 24px 80px rgba(0,0,0,0.6)',
            display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden',
            animation: phase >= 1 ? 'logoEntry 0.85s cubic-bezier(0.34,1.56,0.64,1) both' : 'none',
            zIndex:1,
          }}>
            {branding.logo
              ? <img src={branding.logo} alt={branding.siteName} style={{ width:'88%', height:'88%', objectFit:'contain' }} />
              : <Flame size={50} color="#fff" strokeWidth={1.5} />
            }
          </div>

          {/* Food emoji orbit particles */}
          {phase >= 2 && FOOD_PARTICLES.map((p, i) => (
            <div key={i} style={{
              position:'absolute', width:0, height:0,
              animation:`orbit${i} ${p.speed}s linear infinite`,
            }}>
              <span style={{ fontSize: p.size, display:'block', filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.5))', userSelect:'none' }}>
                {p.emoji}
              </span>
            </div>
          ))}
        </div>

        {/* ── Restaurant name ── */}
        {phase >= 2 && (
          <h1 style={{
            margin: '0 0 6px',
            fontFamily: '"Playfair Display SC", Georgia, "Times New Roman", serif',
            fontSize: 'clamp(28px, 8vw, 44px)',
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: '0.04em',
            background: 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 40%, #FBBF24 60%, #E6B800 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'nameSlideUp 0.65s cubic-bezier(0.22,1,0.36,1) both',
            textShadow: 'none',
          }}>
            {branding.siteName}
          </h1>
        )}

        {/* ── Decorative divider ── */}
        {phase >= 2 && (
          <div style={{
            display:'flex', alignItems:'center', gap:10, margin:'10px 0 14px',
            animation:'tagSlide 0.5s ease 0.1s both',
            width:'80%', maxWidth:240,
          }}>
            <div style={{ flex:1, height:1, background:'linear-gradient(90deg,transparent,rgba(212,160,23,0.5))' }} />
            <span style={{ fontSize:12, color:'rgba(212,160,23,0.7)', letterSpacing:'0.18em', fontWeight:600, whiteSpace:'nowrap' }}>✦ WELCOME ✦</span>
            <div style={{ flex:1, height:1, background:'linear-gradient(90deg,rgba(212,160,23,0.5),transparent)' }} />
          </div>
        )}

        {/* ── Tagline ── */}
        {phase >= 3 && branding.tagline && branding.showTagline && (
          <p style={{
            margin:'0 0 20px', fontSize:11, fontWeight:600,
            color:'rgba(255,255,255,0.4)', letterSpacing:'0.22em', textTransform:'uppercase',
            animation:'tagSlide 0.5s ease both',
          }}>
            {branding.tagline}
          </p>
        )}

        {/* ── Table glassmorphism card ── */}
        {phase >= 3 && (
          <div style={{
            display:'inline-flex', alignItems:'center', gap:14,
            padding:'16px 28px', borderRadius:20,
            background:'rgba(255,255,255,0.05)',
            backdropFilter:'blur(24px) saturate(160%)',
            WebkitBackdropFilter:'blur(24px) saturate(160%)',
            border:'1.5px solid rgba(212,160,23,0.3)',
            boxShadow:'0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
            animation:'cardRise 0.65s cubic-bezier(0.34,1.56,0.64,1) both',
            marginBottom:28,
          }}>
            <div style={{
              width:44, height:44, borderRadius:14,
              background:'linear-gradient(135deg,rgba(212,160,23,0.25),rgba(212,160,23,0.08))',
              border:'1px solid rgba(212,160,23,0.3)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:22,
            }}>
              {isTakeaway ? '🛍️' : '🍽️'}
            </div>
            <div style={{ textAlign:'left' }}>
              <p style={{ margin:0, fontSize:11, color:'rgba(212,160,23,0.65)', fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', marginBottom:2 }}>
                {isTakeaway ? 'Your Order' : 'Your Table'}
              </p>
              <p style={{ margin:0, fontSize:22, fontWeight:900, color:'#FBBF24', lineHeight:1, letterSpacing:'-0.5px', fontFamily:'"Playfair Display SC",Georgia,serif' }}>
                {tableLabel}
              </p>
            </div>
          </div>
        )}

        {/* ── Welcome message ── */}
        {phase >= 4 && (
          <p style={{
            margin:'0 0 0', fontSize:14, color:'rgba(255,255,255,0.45)',
            fontWeight:500, lineHeight:1.75,
            animation:'welcomeIn 0.5s ease both',
          }}>
            Browse our full menu and place<br/>your order right here.
          </p>
        )}
      </div>

      {/* ── Loading dots ── */}
      {phase >= 4 && (
        <div style={{
          position:'absolute', bottom:52, left:0, right:0,
          display:'flex', justifyContent:'center', gap:7, zIndex:2,
        }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width:5, height:5, borderRadius:'50%',
              background:'rgba(212,160,23,0.6)',
              animation:`dotBlink 1.2s ease-in-out ${i * 0.22}s infinite`,
            }} />
          ))}
        </div>
      )}

      {/* ── Gold progress bar ── */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, height:3,
        background:'rgba(255,255,255,0.05)', zIndex:2,
      }}>
        <div style={{
          height:'100%', width:`${progress * 100}%`,
          background:'linear-gradient(90deg,#A16207,#D4A017,#F59E0B,#FDE68A)',
          borderRadius:'0 2px 2px 0',
          position:'relative', overflow:'hidden',
          transition:'width 0.06s linear',
          boxShadow:'0 0 12px rgba(212,160,23,0.7), 0 0 4px rgba(212,160,23,1)',
        }}>
          {/* shimmer on bar */}
          <div style={{
            position:'absolute', inset:0, width:'40%',
            background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)',
            animation:'shimBar 1.4s linear infinite',
          }} />
        </div>
      </div>

      {/* ── Tap to skip ── */}
      <div style={{
        position:'absolute', bottom:12, left:0, right:0,
        display:'flex', justifyContent:'center', zIndex:2,
        animation:'tapHint 2.5s ease-in-out 1.5s infinite',
      }}>
        <span style={{ fontSize:10, color:'rgba(255,255,255,0.22)', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase' }}>
          tap anywhere to skip
        </span>
      </div>
    </div>
  );
}

/* ─── Main QRCodeOrdering ────────────────────────────────────────── */
const QRCodeOrdering = ({ locationSettings, onOrderPlacedWithId, tableId: propTableId }) => {
  const { format: fmt } = useCurrency(locationSettings);
  const [tableId, setTableId]         = useState('Unknown Table/Takeaway');
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [notification, setNotification]     = useState(null);
  const [showTracker, setShowTracker]       = useState(false);
  const [branding, setBranding]             = useState(() => loadBranding());
  const [splashDone, setSplashDone]         = useState(false);

  useEffect(() => {
    if (propTableId) {
      setTableId(propTableId);
    } else {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('tableId');
      if (id) setTableId(id);
    }
  }, [propTableId]);

  useEffect(() => {
    fetchBrandingFromServer().then(b => { if (b) setBranding(b); });
    const reload = () => setBranding(loadBranding());
    window.addEventListener('branding-updated', reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener('branding-updated', reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const tableLabel = useMemo(() => {
    const raw = String(tableId || '').trim();
    if (!raw) return 'Takeaway';
    if (/takeaway/i.test(raw)) return 'Takeaway';
    const num = raw.replace(/^T/i, '');
    return `Table ${num}`;
  }, [tableId]);

  const isTakeaway = /takeaway/i.test(tableLabel);

  const handleOrderPlaced = (order) => {
    setCurrentOrderId(order.id);
    setNotification({
      message: `Order #${order.id} placed! ${fmt(order.total)} — you can add more items below.`,
      type: 'success',
      duration: 6000,
    });
    if (onOrderPlacedWithId) onOrderPlacedWithId(order.id);
  };

  const handleNewOrder = () => {
    setCurrentOrderId(null);
    setShowTracker(false);
    setNotification(null);
  };

  const logoRadius =
    branding.logoShape === 'circle' ? '9999px'
      : branding.logoShape === 'square' ? '4px' : '12px';

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: 'var(--app-bg, #F8FAFC)' }}>
      <style>{SPLASH_CSS}</style>

      {/* ── Cinematic welcome splash ── */}
      {!splashDone && (
        <WelcomeSplash
          branding={branding}
          tableLabel={tableLabel}
          isTakeaway={isTakeaway}
          onDone={() => setSplashDone(true)}
        />
      )}

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
          duration={notification.duration}
        />
      )}

      {/* ── Sticky header ── */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'linear-gradient(135deg, #0A1628 0%, #14306B 55%, #1E3A8A 100%)',
          boxShadow: '0 4px 24px rgba(10, 22, 40, 0.35)',
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:34, height:34, borderRadius: logoRadius, flexShrink:0, overflow:'hidden',
              background: branding.logo ? 'rgba(255,255,255,0.95)' : 'linear-gradient(135deg,#D4A017,#A16207)',
              boxShadow:'0 4px 16px rgba(212,160,23,0.35)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {branding.logo
                ? <img src={branding.logo} alt={branding.siteName} style={{ width:'100%', height:'100%', objectFit:'contain', padding:2 }} />
                : <Flame size={16} color="#fff" />
              }
            </div>
            <div style={{ minWidth:0 }}>
              <p style={{
                margin:0, fontWeight:800, fontSize:14, color:'#fff', lineHeight:1.2,
                fontFamily:'"Playfair Display SC",Georgia,serif',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:170,
              }}>
                {branding.siteName}
              </p>
              {branding.showTagline && branding.tagline && (
                <p style={{ margin:'1px 0 0', fontSize:9, color:'#D4A017', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase' }}>
                  {branding.tagline}
                </p>
              )}
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold shrink-0"
            style={{
              background: isTakeaway ? 'linear-gradient(135deg,#D4A017,#A16207)' : 'rgba(212,160,23,0.14)',
              border:'1px solid rgba(212,160,23,0.35)',
              color:'#FBBF24',
            }}
          >
            {isTakeaway ? <Sparkles className="w-3.5 h-3.5" /> : <UtensilsCrossed className="w-3.5 h-3.5" />}
            {tableLabel}
          </span>
        </div>
        <div className="h-px" style={{ background:'linear-gradient(90deg,transparent,rgba(212,160,23,0.55),transparent)' }} />
      </header>

      {/* ── Content ── */}
      {showTracker && currentOrderId ? (
        <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">
          <CustomerOrderTracker orderId={currentOrderId} tableId={tableId} locationSettings={locationSettings} />
          <div className="text-center mt-8">
            <button
              onClick={handleNewOrder}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-orange-200 transition active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              Place Another Order
            </button>
          </div>
        </div>
      ) : (
        <main className="flex-1">
          <SimpleMenu
            tableId={tableId}
            onOrderPlaced={handleOrderPlaced}
            locationSettings={locationSettings}
          />
        </main>
      )}

      <footer className="py-4 text-center text-[10px]" style={{ color:'var(--text-muted,#94A3B8)' }}>
        Powered by {branding.siteName}
      </footer>
    </div>
  );
};

export default QRCodeOrdering;
