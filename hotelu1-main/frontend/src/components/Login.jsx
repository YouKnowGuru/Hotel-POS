import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { getAPI_URL } from '../utils/api';
import BrandMark from './BrandMark';
import { loadBranding, BRANDING_UPDATED_EVENT } from '../utils/branding';
import PwaInstallButton from './PwaInstallButton';

/* ------------------------------------------------------------------ *
 * Staff sign-in
 *
 * This screen intentionally carries NO marketing copy. There are no
 * statistics, performance figures, superlatives, feature claims,
 * testimonials or social-proof blocks. Everything visible is either
 * the administrator's own branding or a plain explanation of the
 * sign-in flow.
 *
 * The full ambient background is purely decorative and is kept at the
 * user's request: blurred colour orbs, a twinkling starfield and the
 * shooting stars. None of it is a product claim.
 * ------------------------------------------------------------------ */

const textMuted = '#94A3B8';
const textFaint = '#64748B';
const gold = 'var(--theme-gold, #D4A017)';

/* ── Soft blurred colour orbs ── */
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

const AmbientOrbs = () => (
  <div
    className="li-ambient absolute inset-0 overflow-hidden pointer-events-none"
    style={{ zIndex: 1 }}
    aria-hidden="true"
  >
    <FloatingOrb size="400px" color="var(--theme-primary, #4338CA)" opacity="0.08" top="-10%" left="-5%" delay="0" duration="20" />
    <FloatingOrb size="300px" color="var(--theme-gold, #D4A017)" opacity="0.06" top="50%" left="60%" delay="2" duration="25" />
    <FloatingOrb size="350px" color="#1E40AF" opacity="0.07" top="70%" left="10%" delay="4" duration="30" />
  </div>
);

/* ── Twinkling starfield ──
   Small static dots that fade in/out with randomised delays and durations
   so the field never pulses in unison. */
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
    <div
      className="li-ambient absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
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

/* ── Shooting stars ──
   Diagonal streaks with glowing gradient tails. Each star has its own
   start position, angle, speed and delay so they never look synchronized. */
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

const HUE_GRADIENTS = {
  white: { tail: '255, 255, 255', glow: 'rgba(255, 255, 255, 0.8)' },
  gold:  { tail: '212, 160, 23',  glow: 'rgba(252, 211, 77, 0.8)' },
  navy:  { tail: '99, 102, 241',  glow: 'rgba(129, 140, 248, 0.8)' },
};

const ShootingStar = ({ config }) => {
  const { top, left, angle, delay, duration, tail, thickness, hue } = config;
  const colors = HUE_GRADIENTS[hue] || HUE_GRADIENTS.white;
  const cycleDuration = duration + 6; // pause between launches

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: `${top}%`,
        left: `${left}%`,
        // `backwards` applies the 0% keyframe during the delay, so stars
        // stay invisible until their launch instead of showing as static lines.
        animation: `shooting-star-fly ${cycleDuration}s linear ${delay}s infinite backwards`,
        '--fly-angle': `${angle}deg`,
        '--fly-distance': '120vw',
        '--tail-length': `${tail}px`,
      }}
    >
      {/* Streak — a rotated bar with a gradient tail */}
      <div
        style={{
          position: 'relative',
          width: `${tail}px`,
          height: `${thickness}px`,
          transform: `rotate(${angle}deg)`,
          transformOrigin: 'right center',
          borderRadius: '999px',
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
  <div
    className="li-ambient li-shooting-stars absolute inset-0 overflow-hidden pointer-events-none"
    style={{ zIndex: 1 }}
    aria-hidden="true"
  >
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
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null); // 'username' | 'password' | null
  // Follows the restaurant's configured branding; updates live on save.
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
    setNotice('');
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

  const fieldStyle = (key) => ({
    background: focused === key ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.035)',
    border: `1px solid ${focused === key ? 'rgba(212,160,23,0.45)' : 'rgba(255,255,255,0.09)'}`,
    boxShadow: focused === key ? '0 0 0 3px rgba(212,160,23,0.10)' : 'none',
  });

  const inputClass =
    'w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 rounded-xl text-white placeholder-slate-400 transition-all duration-200 focus:outline-none';

  return (
    <div
      className="min-h-screen w-full flex relative"
      style={{
        background: 'linear-gradient(135deg, #0B1220 0%, #0F172A 55%, #141C34 100%)',
        minHeight: '100dvh',
      }}
    >
      {/* Ambient background — decorative, above the panel wash but below all content */}
      <AmbientOrbs />
      <Starfield />
      <ShootingStars />

      {/* ====== LEFT PANEL — quiet brand field (desktop only) ====== */}
      <div className="hidden lg:flex relative w-1/2 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <img
            src="/restaurant-bg.jpg"
            alt=""
            className="w-full h-full object-cover"
            style={{ opacity: 0.07 }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(160deg, rgba(11,18,32,0.88) 0%, rgba(19,27,51,0.82) 45%, rgba(20,28,52,0.90) 100%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 12% 18%, rgba(212,160,23,0.07), transparent 55%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.025,
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col w-full h-full p-10 xl:p-16 text-white">
          <BrandMark
            size={48}
            iconSize={26}
            nameClass="text-lg font-bold tracking-wide"
            taglineClass="text-xs"
            light
          />

          <div className="flex-1 flex items-center">
            <div style={{ maxWidth: 360 }}>
              <div
                className="mb-8"
                style={{ width: 40, height: 2, background: gold }}
              />
              <p
                className="text-xs font-semibold uppercase mb-4"
                style={{ color: textMuted, letterSpacing: '0.22em' }}
              >
                Staff portal
              </p>
              <h1 className="text-3xl xl:text-4xl font-semibold leading-tight font-brand text-white">
                Management console
              </h1>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: textMuted }}>
                Sign in with the staff account provided by your administrator.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ====== RIGHT PANEL — sign-in form (full width on mobile) ====== */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-5 py-10 sm:px-8 relative z-10"
        style={{ minHeight: '100dvh' }}
      >
        <div className="w-full" style={{ maxWidth: 420 }}>
          {/* Mobile brand (hidden on desktop) */}
          <div className="lg:hidden flex justify-center mb-8">
            <BrandMark
              size={44}
              iconSize={22}
              nameClass="text-lg font-bold"
              taglineClass="text-xs"
              light
            />
          </div>

          <div
            className="rounded-2xl p-7 sm:p-9"
            style={{
              background: 'rgba(255, 255, 255, 0.035)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
            }}
          >
            <h2 className="text-2xl font-semibold text-white font-brand">
              Welcome back
            </h2>
            <p className="text-sm mt-1.5" style={{ color: textMuted }}>
              Enter your credentials to continue.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              {/* Username */}
              <div className="relative">
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center w-11 sm:w-12 transition-colors duration-200"
                  style={{ color: focused === 'username' ? gold : textFaint }}
                >
                  <User className="w-[18px] h-[18px]" />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  aria-label="Username"
                  required
                  disabled={loading}
                  autoComplete="username"
                  className={inputClass}
                  style={fieldStyle('username')}
                  onFocus={() => setFocused('username')}
                  onBlur={() => setFocused(null)}
                />
              </div>

              {/* Password */}
              <div className="relative">
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center w-11 sm:w-12 transition-colors duration-200"
                  style={{ color: focused === 'password' ? gold : textFaint }}
                >
                  <Lock className="w-[18px] h-[18px]" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  aria-label="Password"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  className={`${inputClass} pr-11 sm:pr-12`}
                  style={fieldStyle('password')}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 w-11 sm:w-12 flex items-center justify-center transition hover:text-white"
                  style={{ color: textFaint }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-[18px] h-[18px]" />
                  ) : (
                    <Eye className="w-[18px] h-[18px]" />
                  )}
                </button>
              </div>

              {/* Forgot password — honest, no fake reset flow */}
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm font-medium transition hover:opacity-80"
                  style={{ color: gold }}
                  onClick={() => {
                    setError('');
                    setNotice('Password resets are handled by your administrator.');
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {notice && (
                <div
                  role="status"
                  className="text-sm p-3 rounded-xl"
                  style={{
                    background: 'rgba(148, 163, 184, 0.08)',
                    border: '1px solid rgba(148, 163, 184, 0.15)',
                    color: '#CBD5E1',
                  }}
                >
                  {notice}
                </div>
              )}

              {error && (
                <div
                  role="alert"
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90"
                style={{
                  background:
                    'linear-gradient(135deg, var(--theme-primary, #4338CA) 0%, var(--theme-primary-deep, #1E3A8A) 100%)',
                  boxShadow: '0 4px 20px rgba(67,56,202,0.28)',
                }}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:justify-between">
            <p className="text-xs" style={{ color: textFaint }}>
              &copy; {new Date().getFullYear()} {siteName} &middot; All rights reserved
            </p>
            <PwaInstallButton variant="quiet" />
          </div>
        </div>
      </div>

      {/* Shooting-star keyframes. The streak starts at its anchor, fades in,
          travels diagonally across the viewport, then stays invisible until
          the next cycle so it "respawns" from the same origin. */}
      <style>{`
        @keyframes float-orb {
          0%   { transform: translate(0, 0); }
          100% { transform: translate(30px, -40px); }
        }
        @keyframes twinkle {
          0%   { opacity: 0.15; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes shooting-star-fly {
          0%   { opacity: 0; transform: translate(0, 0); }
          3%   { opacity: 1; }
          40%  {
            opacity: 1;
            transform: translate(calc(var(--fly-distance, 120vw) * -0.85), calc(var(--fly-distance, 120vw) * 0.7));
          }
          50%  {
            opacity: 0;
            transform: translate(calc(var(--fly-distance, 120vw) * -0.9), calc(var(--fly-distance, 120vw) * 0.75));
          }
          50.01%, 100% { opacity: 0; transform: translate(0, 0); }
        }

        /* Respect the OS reduced-motion preference for ALL ambient layers. */
        @media (prefers-reduced-motion: reduce) {
          .li-ambient { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default Login;
