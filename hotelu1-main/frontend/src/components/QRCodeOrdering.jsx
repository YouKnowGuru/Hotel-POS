import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UtensilsCrossed, Sparkles, ChevronDown } from 'lucide-react';
import SimpleMenu from './SimpleMenu';
import CustomerOrderTracker from './CustomerOrderTracker';
import Notification from './Notification';
import { loadBranding, fetchBrandingFromServer } from '../utils/branding';
import useCurrency from '../hooks/useCurrency';
import { Flame } from 'lucide-react';

/* ─── Splash duration ───────────────────────────────────────────── */
const SPLASH_MS = 2800;

/* ─── Inline keyframes injected once ───────────────────────────── */
const SPLASH_CSS = `
  @keyframes splashFadeIn  { from { opacity:0; transform:scale(0.92) } to { opacity:1; transform:scale(1) } }
  @keyframes splashSlideUp { from { opacity:0; transform:translateY(40px) } to { opacity:1; transform:translateY(0) } }
  @keyframes splashOut     { from { opacity:1; transform:translateY(0) } to { opacity:0; transform:translateY(-40px) } }
  @keyframes shimmerBar    { from { transform:translateX(-100%) } to { transform:translateX(100%) } }
  @keyframes orbFloat      { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-22px) scale(1.04)} }
  @keyframes starPulse     { 0%,100%{opacity:0.15;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.4)} }
  @keyframes logoPopIn     { 0%{opacity:0;transform:scale(0.5) rotate(-12deg)} 60%{transform:scale(1.12) rotate(3deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
  @keyframes pillBounce    { 0%{opacity:0;transform:translateY(12px)} 100%{opacity:1;transform:translateY(0)} }
  @keyframes menuSlideIn   { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
  .qr-splash-out { animation: splashOut 0.55s cubic-bezier(0.4,0,0.2,1) forwards !important; }
  .qr-menu-in    { animation: menuSlideIn 0.55s cubic-bezier(0.4,0,0.2,1) both; }
`;

/* ─── Random star positions (stable per session) ────────────────── */
const STARS = Array.from({ length: 18 }, (_, i) => ({
  x: (((i * 137 + 23) % 100)),
  y: (((i * 79 + 11) % 100)),
  size: 2 + (i % 3),
  delay: (i * 0.18) % 2,
  dur: 1.5 + (i % 3) * 0.5,
}));

/* ─── Splash Screen ─────────────────────────────────────────────── */
function WelcomeSplash({ branding, tableLabel, isTakeaway, onDone }) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    // Animate progress bar
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
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const triggerExit = () => {
    setExiting(true);
    setTimeout(onDone, 550);
  };

  const logoRadius =
    branding.logoShape === 'circle' ? '9999px'
      : branding.logoShape === 'square' ? '8px' : '22px';

  return (
    <div
      className={exiting ? 'qr-splash-out' : ''}
      onClick={triggerExit}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(145deg, #0A1628 0%, #0f2144 40%, #1a1040 70%, #0e0c24 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', cursor: 'pointer',
        animation: 'splashFadeIn 0.6s cubic-bezier(0.4,0,0.2,1) both',
      }}
    >
      <style>{SPLASH_CSS}</style>

      {/* ── Decorative orbs ── */}
      <div style={{ position:'absolute', top:'8%', left:'12%', width:260, height:260, borderRadius:'50%', background:'radial-gradient(circle,rgba(212,160,23,0.18),transparent 70%)', animation:'orbFloat 6s ease-in-out infinite', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'10%', right:'8%', width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,0.2),transparent 70%)', animation:'orbFloat 8s ease-in-out infinite reverse', pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:'45%', left:'-6%', width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle,rgba(244,63,94,0.12),transparent 70%)', animation:'orbFloat 7s ease-in-out infinite 1s', pointerEvents:'none' }} />

      {/* ── Star particles ── */}
      {STARS.map((st, i) => (
        <div key={i} style={{
          position:'absolute', left:`${st.x}%`, top:`${st.y}%`,
          width: st.size, height: st.size, borderRadius:'50%',
          background:'#fff', pointerEvents:'none',
          animation:`starPulse ${st.dur}s ease-in-out ${st.delay}s infinite`,
        }} />
      ))}

      {/* ── Gold top hairline ── */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,#D4A017,#F59E0B,#D4A017,transparent)' }} />

      {/* ── Main content ── */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0, padding:'0 24px', textAlign:'center', maxWidth:360 }}>

        {/* Logo */}
        <div style={{
          width:100, height:100, borderRadius: logoRadius,
          background: branding.logo ? 'rgba(255,255,255,0.97)' : 'linear-gradient(135deg,#D4A017 0%,#A16207 100%)',
          boxShadow:'0 0 0 6px rgba(212,160,23,0.15), 0 0 0 12px rgba(212,160,23,0.06), 0 20px 60px rgba(0,0,0,0.5)',
          display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden',
          animation:'logoPopIn 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.25s both',
          marginBottom: 28,
        }}>
          {branding.logo
            ? <img src={branding.logo} alt={branding.siteName} style={{ width:'85%', height:'85%', objectFit:'contain' }} />
            : <Flame size={48} color="#fff" />
          }
        </div>

        {/* Site name */}
        <h1 style={{
          margin:'0 0 8px', fontFamily:'"Playfair Display SC",Georgia,serif',
          fontSize: 'clamp(26px,7vw,38px)', fontWeight:900, lineHeight:1.1,
          background:'linear-gradient(135deg,#FBBF24,#FDE68A,#F59E0B)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          letterSpacing:'-0.5px',
          animation:'splashSlideUp 0.6s cubic-bezier(0.4,0,0.2,1) 0.55s both',
        }}>
          {branding.siteName}
        </h1>

        {/* Tagline */}
        {branding.tagline && branding.showTagline && (
          <p style={{
            margin:'0 0 24px', fontSize:13, fontWeight:600,
            color:'rgba(255,255,255,0.45)', letterSpacing:'0.22em', textTransform:'uppercase',
            animation:'splashSlideUp 0.6s cubic-bezier(0.4,0,0.2,1) 0.68s both',
          }}>
            {branding.tagline}
          </p>
        )}

        {/* Table badge */}
        <div style={{
          display:'inline-flex', alignItems:'center', gap:7,
          padding:'9px 20px', borderRadius:9999,
          background: isTakeaway
            ? 'linear-gradient(135deg,#D4A017,#A16207)'
            : 'rgba(212,160,23,0.12)',
          border:'1.5px solid rgba(212,160,23,0.4)', color:'#FBBF24',
          fontSize:13, fontWeight:800, letterSpacing:'0.03em',
          boxShadow: isTakeaway ? '0 6px 24px rgba(212,160,23,0.35)' : 'none',
          animation:'pillBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.82s both',
          marginBottom: 36,
        }}>
          {isTakeaway ? <Sparkles size={14}/> : <UtensilsCrossed size={14}/>}
          {tableLabel}
        </div>

        {/* Welcome text */}
        <p style={{
          margin:0, fontSize:15, color:'rgba(255,255,255,0.55)', fontWeight:500, lineHeight:1.6,
          animation:'splashSlideUp 0.6s cubic-bezier(0.4,0,0.2,1) 0.9s both',
        }}>
          Welcome! Browse our menu and<br/>place your order below.
        </p>
      </div>

      {/* ── Progress bar ── */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0,
        height:4, background:'rgba(255,255,255,0.06)',
        overflow:'hidden',
      }}>
        <div style={{
          height:'100%', width:`${progress * 100}%`,
          background:'linear-gradient(90deg,#D4A017,#F59E0B,#FDE68A)',
          transition:'width 0.05s linear',
          boxShadow:'0 0 8px rgba(212,160,23,0.6)',
          position:'relative', overflow:'hidden',
        }}>
          {/* shimmer */}
          <div style={{
            position:'absolute', inset:0,
            background:'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.35) 50%,transparent 100%)',
            animation:'shimmerBar 1.2s linear infinite',
          }} />
        </div>
      </div>

      {/* ── Tap to skip hint ── */}
      <div style={{
        position:'absolute', bottom:20, right:20,
        fontSize:11, color:'rgba(255,255,255,0.25)', fontWeight:600, letterSpacing:'0.05em',
        display:'flex', alignItems:'center', gap:4,
        animation:'splashSlideUp 0.5s ease 1.2s both',
      }}>
        Tap to skip <ChevronDown size={12}/>
      </div>
    </div>
  );
}

/* ─── Main QRCodeOrdering component ────────────────────────────── */
const QRCodeOrdering = ({ locationSettings, onOrderPlacedWithId, tableId: propTableId }) => {
  const { format: fmt } = useCurrency(locationSettings);
  const [tableId, setTableId] = useState('Unknown Table/Takeaway');
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [showTracker, setShowTracker] = useState(false);
  const [branding, setBranding] = useState(() => loadBranding());
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (propTableId) {
      setTableId(propTableId);
    } else {
      const params = new URLSearchParams(window.location.search);
      const idFromUrl = params.get('tableId');
      if (idFromUrl) setTableId(idFromUrl);
    }
  }, [propTableId]);

  // Pull latest branding from server (so the logo/name is always fresh)
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

      {/* ── Welcome Splash ── */}
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
          {/* Brand mark */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:34, height:34, borderRadius: logoRadius,
              background: branding.logo ? 'rgba(255,255,255,0.95)' : 'linear-gradient(135deg,#D4A017,#A16207)',
              boxShadow:'0 4px 16px rgba(212,160,23,0.35)',
              display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0,
            }}>
              {branding.logo
                ? <img src={branding.logo} alt={branding.siteName} style={{ width:'100%', height:'100%', objectFit:'contain', padding:2 }} />
                : <Flame size={16} color="#fff" />
              }
            </div>
            <div style={{ minWidth:0 }}>
              <p style={{
                margin:0, fontWeight:800, fontSize:14, color:'#fff', lineHeight:1.2, letterSpacing:'-0.2px',
                fontFamily:'"Playfair Display SC",Georgia,serif',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:160,
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

          {/* Table badge */}
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold shrink-0"
            style={{
              background: isTakeaway
                ? 'linear-gradient(135deg, #D4A017, #A16207)'
                : 'rgba(212, 160, 23, 0.14)',
              border: '1px solid rgba(212, 160, 23, 0.35)',
              color: '#FBBF24',
            }}
          >
            {isTakeaway ? <Sparkles className="w-3.5 h-3.5" /> : <UtensilsCrossed className="w-3.5 h-3.5" />}
            {tableLabel}
          </span>
        </div>
        {/* Gold hairline */}
        <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,160,23,0.55), transparent)' }} />
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
        <main className={`flex-1 ${splashDone ? 'qr-menu-in' : ''}`}>
          <SimpleMenu
            tableId={tableId}
            onOrderPlaced={handleOrderPlaced}
            locationSettings={locationSettings}
          />
        </main>
      )}

      {/* ── Footer ── */}
      <footer className="py-4 text-center text-[10px]" style={{ color: 'var(--text-muted, #94A3B8)' }}>
        Powered by {branding.siteName}
      </footer>
    </div>
  );
};

export default QRCodeOrdering;
