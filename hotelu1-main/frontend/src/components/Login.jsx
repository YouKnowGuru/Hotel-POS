import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
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
} from 'lucide-react';
import { getAPI_URL } from '../utils/api';
import BrandMark from './BrandMark';
import { loadBranding } from '../utils/branding';

const FEATURE_PILLS = [
  { icon: BarChart3, label: 'Real-time Analytics' },
  { icon: ShoppingBag, label: 'Smart Orders' },
  { icon: Package, label: 'Inventory Control' },
  { icon: Building2, label: 'Multi-Branch' },
];

/* Logo-aware mark for the login card (navy tile, white logo bg). */
const LoginCardMark = () => {
  const branding = loadBranding();
  const radius =
    branding.logoShape === 'circle'
      ? '9999px'
      : branding.logoShape === 'square'
        ? '6px'
        : '16px';
  return (
    <div
      className="w-14 h-14 flex items-center justify-center shadow-lg overflow-hidden"
      style={{
        borderRadius: radius,
        background: branding.logo
          ? '#FFFFFF'
          : 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%)',
        boxShadow: '0 4px 16px rgba(30, 58, 138, 0.25)',
      }}
    >
      {branding.logo ? (
        <img src={branding.logo} alt={branding.siteName} className="w-full h-full object-contain p-1.5" />
      ) : (
        <Flame className="w-7 h-7 text-white" />
      )}
    </div>
  );
};

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen w-full flex" style={{ background: 'var(--app-bg)' }}>

      {/* ====== LEFT PANEL — Navy hero ====== */}
      <div className="hidden md:flex relative w-1/2 overflow-hidden">
        {/* Deep navy base */}
        <div className="absolute inset-0">
          <img
            src="/restaurant-bg.jpg"
            alt=""
            className="w-full h-full object-cover opacity-20"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(160deg, #0A1628 0%, #0F2045 35%, #1E3A8A 100%)' }}
          />
          {/* Gold ambient glow — top left */}
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 15% 20%, rgba(212, 160, 23, 0.15), transparent 55%)' }}
          />
          {/* Navy ambient glow — bottom right */}
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 85% 80%, rgba(30, 64, 175, 0.2), transparent 50%)' }}
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

        <div className="relative z-10 flex flex-col justify-between w-full p-10 lg:p-14 text-white">
          {/* Brand mark */}
          <div className="animate-fade-in">
            <BrandMark size={48} iconSize={26} nameClass="text-lg font-bold tracking-wide" taglineClass="text-xs" light />
          </div>

          {/* Hero copy */}
          <div className="max-w-md stagger-children">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4" style={{ color: '#D4A017' }} />
              <span
                className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: '#D4A017' }}
              >
                Hospitality Intelligence
              </span>
            </div>

            <h1
              className="text-4xl lg:text-5xl font-bold leading-[1.1] font-brand"
            >
              Run Your Hotel.
              <br />
              <span style={{ color: '#D4A017' }}>Smart. Simple.</span>
              <br />
              <span style={{ color: '#D4A017' }}>Powerful.</span>
            </h1>
            <p className="mt-6 text-base leading-relaxed max-w-sm" style={{ color: '#CBD5E1' }}>
              Manage orders, menus, kitchen, inventory, staff, and grow your
              hospitality business — all in one place.
            </p>

            {/* Feature pills — glass style */}
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-md">
              {FEATURE_PILLS.map(({ icon: Icon, label }, idx) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-xl px-4 py-3 backdrop-blur-md transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: 'rgba(255, 255, 255, 0.07)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    animationDelay: `${idx * 80}ms`,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(212, 160, 23, 0.15)' }}
                  >
                    <Icon className="w-4 h-4" style={{ color: '#D4A017' }} />
                  </div>
                  <span className="text-sm font-medium text-white/90 whitespace-nowrap">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom trust line */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {['#1E3A8A', '#D4A017', '#059669', '#7C3AED'].map((c, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: c }}
                >
                  {['A', 'M', 'W', 'C'][i]}
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-medium text-white/80">Trusted by hospitality teams</p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>Multi-branch, multi-role, one platform</p>
            </div>
          </div>
        </div>
      </div>

      {/* ====== RIGHT PANEL — Glass login form ====== */}
      <div className="flex-1 flex flex-col items-center justify-start md:justify-center px-4 sm:px-8 py-10 md:py-12 overflow-y-auto">
        <div className="w-full max-w-md stagger-children">

          {/* Mobile brand (hidden on desktop) */}
          <div className="md:hidden flex items-center justify-center mb-8">
            <BrandMark size={44} iconSize={22} nameClass="text-lg font-bold" taglineClass="text-[11px]" />
          </div>

          {/* ── Login Card (glass) ── */}
          <div
            className="glass-card rounded-2xl p-8 sm:p-10"
            style={{
              background: 'var(--card-bg)',
              backdropFilter: 'blur(20px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Icon + heading */}
            <div className="flex justify-center mb-5">
              <LoginCardMark />
            </div>

            <h2
              className="text-2xl font-bold text-center font-brand"
              style={{ color: 'var(--text-primary)' }}
            >
              Welcome Back
            </h2>
            <p className="text-sm text-center mt-1" style={{ color: 'var(--text-secondary)' }}>
              Sign in to your management dashboard
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              {/* Username */}
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center w-12 text-slate-400">
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
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl text-slate-800 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-2"
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    '--tw-ring-color': 'rgba(59, 130, 246, 0.2)',
                  }}
                  onFocus={(e) => {
                    e.target.style.background = 'var(--card-bg)';
                    e.target.style.borderColor = 'var(--accent-light)';
                  }}
                  onBlur={(e) => {
                    e.target.style.background = 'var(--glass-bg)';
                    e.target.style.borderColor = 'var(--border)';
                  }}
                />
              </div>

              {/* Password */}
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center w-12 text-slate-400">
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
                  className="w-full pl-12 pr-12 py-3.5 rounded-xl text-slate-800 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-2"
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    '--tw-ring-color': 'rgba(59, 130, 246, 0.2)',
                  }}
                  onFocus={(e) => {
                    e.target.style.background = 'var(--card-bg)';
                    e.target.style.borderColor = 'var(--accent-light)';
                  }}
                  onBlur={(e) => {
                    e.target.style.background = 'var(--glass-bg)';
                    e.target.style.borderColor = 'var(--border)';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
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
                    style={{ accentColor: '#1E3A8A' }}
                  />
                  <span style={{ color: 'var(--text-secondary)' }}>Remember me</span>
                </label>
                <button
                  type="button"
                  className="font-semibold transition hover:opacity-80"
                  style={{ color: 'var(--accent)' }}
                  onClick={() =>
                    setError('Please contact your administrator to reset your password.')
                  }
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <div
                  className="text-sm p-3 rounded-xl text-center"
                  style={{
                    background: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    color: 'var(--danger)',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit — Navy gradient */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: 'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%)',
                  boxShadow: '0 4px 16px rgba(30, 58, 138, 0.2)',
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

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              &copy; 2026 Hotel POS &middot; All rights reserved
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
