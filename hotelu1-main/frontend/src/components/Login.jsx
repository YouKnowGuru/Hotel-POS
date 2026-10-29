import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  BarChart3,
  ShoppingBag,
  Package,
  Building2,
  Sparkles,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { getAPI_URL } from '../utils/api';
import BrandMark from './BrandMark';
import { loadBranding, BRANDING_UPDATED_EVENT } from '../utils/branding';
import PwaInstallButton from './PwaInstallButton';

const FEATURE_PILLS = [
  { icon: BarChart3, label: 'Real-time Analytics', color: '#3B82F6' },
  { icon: ShoppingBag, label: 'Smart Orders', color: 'var(--theme-gold, #D4A017)' },
  { icon: Package, label: 'Inventory Control', color: '#059669' },
  { icon: Building2, label: 'Multi-Branch', color: '#7C3AED' },
];

const STATS = [
  { icon: TrendingUp, label: 'Revenue uplift', value: '+24%' },
  { icon: ShieldCheck, label: 'Uptime', value: '99.9%' },
  { icon: Package, label: 'Orders/day', value: '1.2K+' },
];

/* Animated floating orb for ambient background */
const FloatingOrb = ({ size, color, opacity, top, left, delay, duration }) => (
  <div
    className="absolute rounded-full"
    style={{
      width: size,
      height: size,
      background: color,
      opacity: opacity,
      top: top,
      left: left,
      filter: 'blur(60px)',
      animation: `float-orb ${duration}s ease-in-out ${delay}s infinite alternate`,
    }}
  />
);

/* ── Twinkling starfield ──
   Generates a field of small static stars that twinkle in/out with
   randomized delays and durations for an organic, non-uniform feel. */
const STAR_COUNT = 80;
const Starfield = () => {
  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 5,
        duration: Math.random() * 3 + 2,
        opacity: Math.random() * 0.5 + 0.3,
      })),
    []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
            animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
};

/* ── Shooting Stars ──
   Renders multiple shooting stars that streak diagonally across the
   screen with glowing gradient tails. Each star has randomized start
   position, angle, speed, and delay so they never look synchronized.

   The tail is built from a linear-gradient on a thin rotated bar whose
   height is the "thickness" of the streak. The head is a bright dot
   with a radial glow at the leading edge. */
const ShootingStarConfig = [
  { top: 5,  left: 70, angle: 215, delay: 0.5,  duration: 3.5, tail: 180, thickness: 2,   hue: 'white' },
  { top: 15, left: 85, angle: 210, delay: 2.8,  duration: 4,   tail: 220, thickness: 1.5, hue: 'gold'  },
  { top: 30, left: 95, angle: 220, delay: 5.2,  duration: 3.8, tail: 160, thickness: 2,   hue: 'navy'  },
  { top: 8,  left: 50, angle: 225, delay: 8.1,  duration: 4.2, tail: 200, thickness: 1.5, hue: 'white' },
  { top: 40, left: 80, angle: 215, delay: 11.3, duration: 3.6, tail: 190, thickness: 2.5, hue: 'gold'  },
  { top: 20, left: 60, angle: 220, delay: 14.5, duration: 4.5, tail: 240, thickness: 2,   hue: 'navy'  },
  { top: 55, left: 90, angle: 225, delay: 17.2, duration: 3.9, tail: 170, thickness: 1.5, hue: 'white' },
  { top: 3,  left: 30, angle: 230, delay: 20.0, duration: 4.1, tail: 210, thickness: 2,   hue: 'gold'  },
];

/* Color palette matches the login page theme exactly:
   - gold   → #D4A017 (var(--theme-gold))      — primary accent
   - navy   → #4338CA (var(--theme-primary))   — indigo/brand
   - white  → #FFFFFF                            — neutral highlight
   The "head" of each star uses a white-hot core that fades into the
   theme color, mimicking real meteor colors. */
const HUE_GRADIENTS = {
  white: { tail: '255, 255, 255', glow: 'rgba(255, 255, 255, 0.8)' },
  gold:  { tail: '212, 160, 23',  glow: 'rgba(252, 211, 77, 0.8)' },
  navy:  { tail: '99, 102, 241',  glow: 'rgba(129, 140, 248, 0.8)' },
};

const ShootingStar = ({ config }) => {
  const { top, left, angle, delay, duration, tail, thickness, hue } = config;
  const colors = HUE_GRADIENTS[hue] || HUE_GRADIENTS.white;
  const cycleDuration = duration + 6; // 6s pause between launches

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: `${top}%`,
        left: `${left}%`,
        animation: `shooting-star-fly ${cycleDuration}s linear ${delay}s infinite`,
        // The star starts fully off-screen (translateX beyond its tail length)
        // and flies diagonally. We use CSS vars consumed by the keyframes.
        '--fly-angle': `${angle}deg`,
        '--fly-distance': '120vw',
        '--tail-length': `${tail}px`,
      }}
    >
      {/* The streak — a rotated bar with a gradient tail */}
      <div
        style={{
          position: 'relative',
          width: `${tail}px`,
          height: `${thickness}px`,
          transform: `rotate(${angle}deg)`,
          transformOrigin: 'right center',
          borderRadius: '999px',
          // Tail fades from transparent (trailing edge) to bright (head)
          background: `linear-gradient(to right, rgba(${colors.tail}, 0) 0%, rgba(${colors.tail}, 0.1) 30%, rgba(${colors.tail}, 0.4) 70%, rgba(${colors.tail}, 1) 100%)`,
          filter: `drop-shadow(0 0 6px ${colors.glow})`,
        }}
      >
        {/* Bright head dot at the leading edge */}
        <div
          style={{
            position: 'absolute',
            right: `-${thickness * 1.5}px`,
            top: '50%',
            transform: 'translateY(-50%)',
            width: `${thickness * 3}px`,
            height: `${thickness * 3}px`,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(${colors.tail}, 0.8) 40%, rgba(${colors.tail}, 0) 70%)`,
            boxShadow: `0 0 ${thickness * 4}px ${colors.glow}, 0 0 ${thickness * 8}px ${colors.glow}`,
          }}
        />
      </div>
    </div>
  );
};

const ShootingStars = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]" aria-hidden="true">
    {ShootingStarConfig.map((config, i) => (
      <ShootingStar key={i} config={config} />
    ))}
  </div>
);

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null); // 'username' | 'password' | null
  // Footer brand name — follows the restaurant's configured branding instead
  // of a hardcoded product name, and updates when the branding fetch lands.
  const [siteName, setSiteName] = useState(() => loadBranding().siteName);

  useEffect(() => {
    const onBranding = () => setSiteName(loadBranding().siteName);
    window.addEventListener(BRANDING_UPDATED_EVENT, onBranding);
    window.addEventListener('storage', onBranding);
    return () => {
      window.removeEventListener(BRANDING_UPDATED_EVENT, onBranding);
      window.removeEventListener('storage', onBranding);
    };
  }, []);

  const submitLogin = async (uname, pwd) => {
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${getAPI_URL()}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname, password: pwd }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (onLogin) onLogin(data.user, data.token);
        navigate('/dashboard');
      } else {
        setError(data.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitLogin(username, password);
  };

  return (
    <div
      className="min-h-screen w-full flex relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0B1220 0%, #0F172A 40%, #1E1B4B 100%)',
        minHeight: '100dvh',
      }}
    >
      {/* ====== Twinkling starfield (global background) ====== */}
      <Starfield />

      {/* ====== Shooting stars (global background) ====== */}
      <ShootingStars />

      {/* ====== Ambient floating orbs (global background) ====== */}
      <FloatingOrb size="400px" color="var(--theme-primary, #4338CA)" opacity="0.08" top="-10%" left="-5%" delay="0" duration="20" />
      <FloatingOrb size="300px" color="var(--theme-gold, #D4A017)" opacity="0.06" top="50%" left="60%" delay="2" duration="25" />
      <FloatingOrb size="350px" color="#1E40AF" opacity="0.07" top="70%" left="10%" delay="4" duration="30" />

      {/* ====== LEFT PANEL — Navy hero (desktop only) ====== */}
      <div className="hidden lg:flex relative w-1/2 overflow-hidden">
        {/* Background image + gradient overlay */}
        <div className="absolute inset-0">
          <img
            src="/restaurant-bg.jpg"
            alt=""
            className="w-full h-full object-cover opacity-15"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(160deg, rgba(11,18,32,0.85) 0%, rgba(19,27,51,0.75) 35%, rgba(67,56,202,0.6) 100%)' }}
          />
          {/* Gold ambient glow — top left */}
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 15% 20%, rgba(212, 160, 23, 0.12), transparent 55%)' }}
          />
          {/* Navy ambient glow — bottom right */}
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 85% 80%, rgba(30, 64, 175, 0.18), transparent 50%)' }}
          />
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between w-full p-10 xl:p-16 text-white">
          {/* Brand mark */}
          <div className="animate-fade-in">
            <BrandMark size={48} iconSize={26} nameClass="text-lg font-bold tracking-wide" taglineClass="text-xs" light />
          </div>

          {/* Hero copy */}
          <div className="max-w-lg stagger-children">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--theme-gold, #D4A017)' }} />
              <span
                className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: 'var(--theme-gold, #D4A017)' }}
              >
                Hospitality Intelligence
              </span>
            </div>

            <h1
              className="text-4xl xl:text-6xl font-bold leading-[1.05] font-brand"
            >
              Run Your Hotel.
              <br />
              <span style={{ background: 'linear-gradient(135deg, var(--theme-gold, #D4A017) 0%, #FCD34D 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Smart. Simple.
              </span>
              <br />
              <span style={{ background: 'linear-gradient(135deg, var(--theme-gold, #D4A017) 0%, #FCD34D 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Powerful.
              </span>
            </h1>
            <p className="mt-6 text-base leading-relaxed max-w-md" style={{ color: '#94A3B8' }}>
              Manage orders, menus, kitchen, inventory, staff, and grow your
              hospitality business — all in one platform.
            </p>

            {/* Feature pills — glass style */}
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-md">
              {FEATURE_PILLS.map(({ icon: Icon, label, color }, idx) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-300 hover:scale-[1.03] hover:bg-white/[0.06] cursor-default"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(8px)',
                    animationDelay: `${idx * 80}ms`,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: `${color}15`,
                      boxShadow: `0 0 20px ${color}20`,
                    }}
                  >
                    <Icon className="w-4 h-4" style={{ color: color }} />
                  </div>
                  <span className="text-sm font-medium text-white/90 whitespace-nowrap">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Stats bar */}
            <div className="mt-8 flex gap-6 max-w-md">
              {STATS.map(({ icon: StatIcon, label, value }) => (
                <div key={label} className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <StatIcon className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-2xl font-bold text-white">{value}</span>
                  </div>
                  <span className="text-xs" style={{ color: '#64748B' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom trust line */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {['var(--theme-primary, #4338CA)', 'var(--theme-gold, #D4A017)', '#059669', '#7C3AED'].map((c, i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: c, borderColor: '#0B1220', boxShadow: `0 2px 8px ${c}40` }}
                >
                  {['A', 'M', 'W', 'C'][i]}
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-medium text-white/80">Trusted by hospitality teams</p>
              <p className="text-xs" style={{ color: '#64748B' }}>Multi-branch, multi-role, one platform</p>
            </div>
          </div>
        </div>
      </div>

      {/* ====== RIGHT PANEL — Login form (full width on mobile) ====== */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-5 py-8 sm:px-8 sm:py-12 overflow-y-auto relative z-10"
        style={{ minHeight: '100dvh' }}
      >
        {/* Mobile background gradient overlay */}
        <div
          className="absolute inset-0 lg:hidden"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(67,56,202,0.15) 0%, transparent 60%)',
          }}
        />

        <div className="w-full max-w-md relative z-10 stagger-children">
          {/* Mobile brand (hidden on desktop) */}
          <div className="lg:hidden flex flex-col items-center mb-6">
            <BrandMark size={44} iconSize={22} nameClass="text-lg font-bold" taglineClass="text-[11px]" light />
          </div>

          {/* ── Login Card (glass) ── */}
          <div
            className="rounded-3xl p-6 sm:p-10 relative overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset',
            }}
          >
            {/* Card top accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-[3px]"
              style={{
                background: 'linear-gradient(90deg, transparent, var(--theme-gold, #D4A017) 30%, var(--theme-primary, #4338CA) 70%, transparent)',
                opacity: 0.6,
              }}
            />

            {/* Quick Install PWA Pill */}
            <div className="flex justify-end mb-2">
              <PwaInstallButton />
            </div>

            <h2
              className="text-2xl sm:text-3xl font-bold text-center font-brand text-white mt-2"
            >
              Welcome Back
            </h2>
            <p className="text-sm text-center mt-1.5" style={{ color: '#94A3B8' }}>
              Sign in to your management dashboard
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Username */}
              <div className="relative">
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center w-11 sm:w-12 transition-colors duration-200"
                  style={{ color: focused === 'username' ? 'var(--theme-gold, #D4A017)' : '#64748B' }}
                >
                  <User className="w-[18px] h-[18px]" />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  required
                  disabled={loading}
                  autoComplete="username"
                  className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 rounded-xl text-white placeholder-slate-500 transition-all duration-200 focus:outline-none"
                  style={{
                    background: focused === 'username'
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${focused === 'username' ? 'rgba(212,160,23,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: focused === 'username'
                      ? '0 0 0 3px rgba(212,160,23,0.1), 0 4px 16px rgba(0,0,0,0.15)'
                      : 'none',
                  }}
                  onFocus={() => setFocused('username')}
                  onBlur={() => setFocused(null)}
                />
              </div>

              {/* Password */}
              <div className="relative">
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center w-11 sm:w-12 transition-colors duration-200"
                  style={{ color: focused === 'password' ? 'var(--theme-gold, #D4A017)' : '#64748B' }}
                >
                  <Lock className="w-[18px] h-[18px]" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  className="w-full pl-11 sm:pl-12 pr-11 sm:pr-12 py-3 sm:py-3.5 rounded-xl text-white placeholder-slate-500 transition-all duration-200 focus:outline-none"
                  style={{
                    background: focused === 'password'
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${focused === 'password' ? 'rgba(212,160,23,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: focused === 'password'
                      ? '0 0 0 3px rgba(212,160,23,0.1), 0 4px 16px rgba(0,0,0,0.15)'
                      : 'none',
                  }}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 w-11 sm:w-12 flex items-center justify-center transition hover:text-white"
                  style={{ color: '#64748B' }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-[18px] h-[18px]" />
                  ) : (
                    <Eye className="w-[18px] h-[18px]" />
                  )}
                </button>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: 'var(--theme-gold, #D4A017)' }}
                  />
                  <span style={{ color: '#94A3B8' }}>Remember me</span>
                </label>
                <button
                  type="button"
                  className="font-semibold transition hover:opacity-80"
                  style={{ color: 'var(--theme-gold, #D4A017)' }}
                  onClick={() =>
                    setError('Please contact your administrator to reset your password.')
                  }
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <div
                  className="text-sm p-3 rounded-xl text-center animate-fade-in"
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    color: '#FCA5A5',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit — Gold→Navy gradient */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden group"
                style={{
                  background: 'linear-gradient(135deg, var(--theme-primary, #4338CA) 0%, var(--theme-primary-deep, #1E3A8A) 100%)',
                  boxShadow: '0 4px 24px rgba(67,56,202,0.4)',
                }}
              >
                {/* Shimmer effect overlay */}
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                    transform: 'translateX(-100%)',
                    animation: 'shimmer 1.5s infinite',
                  }}
                />
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            {/* Divider + trust */}
            <div className="mt-6 flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-xs" style={{ color: '#475569' }}>Secure login</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-5 text-center">
            <p className="text-xs" style={{ color: '#475569' }}>
              &copy; {new Date().getFullYear()} {siteName} &middot; All rights reserved
            </p>
          </div>
        </div>
      </div>

      {/* ── Keyframe animations ── */}
      <style>{`
        @keyframes float-orb {
          0%   { transform: translate(0, 0); }
          100% { transform: translate(30px, -40px); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        /* ── Twinkling stars ── */
        @keyframes twinkle {
          0%   { opacity: 0.15; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1.1); }
        }
        /* ── Shooting star fly ──
           The star element is positioned at a top/left anchor. It starts
           fully offset (tail + head hidden off the anchor point), then
           translates diagonally across the screen. Between cycles the
           star is invisible (opacity 0) so it "respawns" from its
           origin each loop.

           We use the CSS custom properties --fly-angle and --fly-distance
           set inline on each star to control direction and travel length.
           The translate is split into two stages:
             0%   — star sits at its origin, fully transparent
             5%   — still at origin, fades in (head becomes visible)
             100% — star has traveled --fly-distance along its angle, fades out */
        @keyframes shooting-star-fly {
          0% {
            opacity: 0;
            transform: translate(0, 0);
          }
          3% {
            opacity: 1;
          }
          /* Travel diagonally: combine translateX/Y along the angle.
             We approximate the diagonal by using translateX for the
             full distance and translateY proportional to the angle.
             For angles ~210-230°, the vertical drop is roughly
             sin(angle) * distance. We hardcode a generic diagonal. */
          40% {
            opacity: 1;
            transform: translate(calc(var(--fly-distance, 120vw) * -0.85), calc(var(--fly-distance, 120vw) * 0.7));
          }
          50% {
            opacity: 0;
            transform: translate(calc(var(--fly-distance, 120vw) * -0.9), calc(var(--fly-distance, 120vw) * 0.75));
          }
          /* Hold invisible until the next cycle */
          50.01%, 100% {
            opacity: 0;
            transform: translate(0, 0);
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
