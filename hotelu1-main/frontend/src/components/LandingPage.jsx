import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Menu, X, Clock, Zap, QrCode, TrendingUp,
  Utensils, CreditCard, Phone, Mail, MapPin, Instagram,
  Facebook, Twitter, Youtube, ArrowUpRight, Star, Sparkles,
} from 'lucide-react';
import QRCodeOrdering from './QRCodeOrdering';

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  // Check for tableId in URL (from QR code scan)
  const params = new URLSearchParams(window.location.search);
  const tableId = params.get('tableId');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavigateToLogin = () => navigate('/login');

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (emailInput) { setSubscribed(true); setEmailInput(''); }
  };

  // If tableId is present (QR scan), show the ordering page directly
  if (tableId) {
    const defaultLocationSettings = { country: 'Bhutan', currencySymbol: 'Nu. ', taxRate: 0.05 };
    return <QRCodeOrdering tableId={tableId} locationSettings={defaultLocationSettings} />;
  }

  return (
    <div className="min-h-screen relative">
      {/* Background Image */}
      <div className="fixed inset-0 z-0">
        <img src="/restaurant-bg.jpg" alt="Restaurant Background" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black bg-opacity-50" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation Bar */}
        <nav className={`fixed w-full top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-black bg-opacity-90 shadow-lg' : 'bg-transparent'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
                <div className="text-3xl text-indigo-400"><Utensils size={32} /></div>
                <div>
                  <span className="text-3xl font-bold text-white">POS System</span>
                  <p className="text-sm text-gray-300">Restaurant Management</p>
                </div>
              </div>
              <div className="hidden md:flex items-center space-x-8">
                <a href="#features" className="text-white font-bold px-6 py-3 rounded-full text-sm bg-indigo-600 bg-opacity-20 border border-indigo-400 hover:bg-opacity-30 hover:text-indigo-300 transition-all duration-300 transform hover:scale-105">Features</a>
              </div>
              <div className="hidden md:flex items-center space-x-4">
                <button onClick={handleNavigateToLogin} className="px-6 py-2.5 rounded-lg border-2 border-indigo-500 text-indigo-400 font-semibold hover:bg-indigo-600 hover:text-white transition">Staff Login</button>
              </div>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-white">
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
            {mobileMenuOpen && (
              <div className="md:hidden bg-black bg-opacity-90 border-t border-gray-600 p-4 space-y-3">
                <a href="#features" className="block text-white font-bold py-2">Features</a>
                <button onClick={() => { setMobileMenuOpen(false); handleNavigateToLogin(); }} className="w-full px-4 py-2.5 rounded-lg border-2 border-indigo-500 text-indigo-400 font-semibold hover:bg-indigo-600 hover:text-white">Staff Login</button>
              </div>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-block bg-indigo-600 bg-opacity-90 text-white px-4 py-1 rounded-full text-sm font-semibold mb-6">🍽️ Modern Restaurant Management</div>
                <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                  Delicious Food,<br /><span className="bg-indigo-700 bg-clip-text text-transparent">Modern Service</span>
                </h1>
                <p className="text-xl text-gray-200 mb-8 leading-relaxed">Experience seamless food ordering with our smart restaurant management system. Track your order in real-time and enjoy faster, better service.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={handleNavigateToLogin} className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl border-2 border-indigo-500 text-indigo-400 font-bold text-lg hover:bg-indigo-600 hover:text-white transition">
                    <span>Staff Portal</span><ChevronRight size={20} />
                  </button>
                </div>
              </div>
              <div className="relative hidden md:block">
                <div className="absolute inset-0 bg-indigo-700 rounded-3xl blur-2xl opacity-30 animate-pulse" />
                <div className="relative bg-black bg-opacity-80 rounded-3xl shadow-2xl p-8 border border-indigo-400 border-opacity-30">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { icon: <Zap size={28} />, label: 'Fast Service', desc: 'Quick order processing', color: 'from-indigo-500 to-indigo-600', text: 'text-indigo-300' },
                      { icon: <Utensils size={28} />, label: 'Fresh Food', desc: 'Premium ingredients', color: 'from-red-400 to-red-500', text: 'text-red-300' },
                      { icon: <Clock size={28} />, label: 'Real-time Track', desc: 'Live order updates', color: 'from-yellow-400 to-yellow-500', text: 'text-yellow-300' },
                      { icon: <CreditCard size={28} />, label: 'Easy Payment', desc: 'Multiple options', color: 'from-green-400 to-green-500', text: 'text-green-300' },
                    ].map((c, i) => (
                      <div key={i} className={`bg-gradient-to-br ${c.color} bg-opacity-40 rounded-2xl p-6 text-center border border-white border-opacity-20 hover:scale-105 transition-all duration-300`}>
                        <div className={`mb-3 ${c.text}`}>{c.icon}</div>
                        <p className="font-bold text-white text-lg">{c.label}</p>
                        <p className="text-sm text-gray-300 mt-1">{c.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-black bg-opacity-70">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Why Choose Us</h2>
              <p className="text-xl text-gray-300">Modern technology meets delicious food</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: <QrCode size={28} className="mx-auto text-white" />, title: 'QR Code Ordering', desc: 'Scan and order directly from your table. No waiting, no paper menus.', bg: 'bg-gradient-to-br from-purple-500 to-purple-600', ibg: 'bg-purple-400' },
                { icon: <Clock size={28} className="mx-auto text-white" />, title: 'Real-time Tracking', desc: 'Track your order status from kitchen to table with live updates.', bg: 'bg-gradient-to-br from-blue-500 to-blue-600', ibg: 'bg-blue-400' },
                { icon: <CreditCard size={28} className="mx-auto text-white" />, title: 'Easy Payments', desc: 'Multiple payment options including cash, card, and QR. Transparent billing.', bg: 'bg-gradient-to-br from-green-500 to-green-600', ibg: 'bg-green-400' },
                { icon: <Utensils size={28} className="mx-auto text-white" />, title: 'Expert Kitchen', desc: 'Our professional kitchen staff prepares each dish with care and quality.', bg: 'bg-indigo-600', ibg: 'bg-indigo-500' },
                { icon: <Zap size={28} className="mx-auto text-white" />, title: 'Fast Service', desc: 'Average preparation time under 15 minutes. Fastest service in the city.', bg: 'bg-gradient-to-br from-yellow-500 to-yellow-600', ibg: 'bg-yellow-400' },
                { icon: <TrendingUp size={28} className="mx-auto text-white" />, title: 'Premium Quality', desc: 'Only fresh ingredients. Hygiene and quality are our top priorities.', bg: 'bg-gradient-to-br from-red-500 to-red-600', ibg: 'bg-red-400' },
              ].map((f, i) => (
                <div key={i} className={`${f.bg} rounded-xl shadow-md p-8 hover:shadow-xl transition text-center transform hover:scale-105`}>
                  <div className={`${f.ibg} rounded-full p-4 w-20 h-20 flex items-center justify-center mx-auto mb-4`}>{f.icon}</div>
                  <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
                  <p className="text-white opacity-90">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-indigo-600 to-red-500">
          <div className="max-w-4xl mx-auto text-center text-white">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Welcome to Our Restaurant</h2>
            <p className="text-xl mb-8 opacity-90">Experience modern restaurant management with our professional staff and quality service.</p>
          </div>
        </section>

        {/* ======================== FOOTER ======================== */}
        <footer style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 70%, #0f172a 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative orbs */}
          <div style={{ position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -60, right: -60, width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 200, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(167,139,250,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '80px 24px 0' }}>

            {/* Newsletter banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(239,68,68,0.15) 100%)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 24,
              padding: '40px 32px',
              marginBottom: 64,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 32,
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Sparkles size={20} color="#a78bfa" />
                  <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase' }}>Stay in the loop</span>
                </div>
                <h3 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: 0 }}>Get exclusive deals & updates</h3>
                <p style={{ color: '#94a3b8', fontSize: 14, margin: '6px 0 0' }}>Join 5,000+ food lovers. No spam, ever.</p>
              </div>
              <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: 12, flex: 1, minWidth: 260 }}>
                {subscribed ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#4ade80', fontWeight: 700, fontSize: 16 }}>
                    <Star size={20} fill="#4ade80" /> Thanks for subscribing! 🎉
                  </div>
                ) : (
                  <>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      placeholder="Enter your email..."
                      required
                      style={{
                        flex: 1, padding: '12px 16px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff', fontSize: 14, outline: 'none',
                      }}
                    />
                    <button type="submit" style={{
                      padding: '12px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                      color: '#fff', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                    }}>
                      Subscribe <ArrowUpRight size={14} />
                    </button>
                  </>
                )}
              </form>
            </div>

            {/* Main footer grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 48, marginBottom: 64 }}>

              {/* Brand column */}
              <div style={{ gridColumn: 'span 1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
                  }}>
                    <Utensils size={22} color="#fff" />
                  </div>
                  <div>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 20, display: 'block', lineHeight: 1 }}>POS System</span>
                    <span style={{ color: '#6366f1', fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>RESTAURANT TECH</span>
                  </div>
                </div>
                <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.8, marginBottom: 24 }}>
                  Transforming the dining experience with cutting-edge cloud technology and seamless service management.
                </p>
                {/* Rating stars */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
                  {[1,2,3,4,5].map(s => <Star key={s} size={14} fill="#f59e0b" color="#f59e0b" />)}
                  <span style={{ color: '#d1d5db', fontSize: 13, marginLeft: 4 }}>4.9 / 5 (2.3k reviews)</span>
                </div>
                {/* Social icons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { icon: <Instagram size={16} />, label: 'Instagram', color: '#e1306c' },
                    { icon: <Facebook size={16} />, label: 'Facebook', color: '#1877f2' },
                    { icon: <Twitter size={16} />, label: 'Twitter', color: '#1da1f2' },
                    { icon: <Youtube size={16} />, label: 'YouTube', color: '#ff0000' },
                  ].map(({ icon, label, color }) => (
                    <a key={label} href="#" title={label} aria-label={label} style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#94a3b8', transition: 'all 0.25s', textDecoration: 'none',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${color}55`; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >{icon}</a>
                  ))}
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h4 style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 20, letterSpacing: 0.5 }}>Quick Links</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Features', href: '#features' },
                    { label: 'Staff Login', href: '/login' },
                    { label: 'QR Ordering', href: '#' },
                    { label: 'Menu', href: '#' },
                    { label: 'About Us', href: '#' },
                  ].map(({ label, href }) => (
                    <li key={label}>
                      <a href={href} style={{
                        color: '#94a3b8', textDecoration: 'none', fontSize: 14,
                        display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#a78bfa'; e.currentTarget.style.paddingLeft = '6px'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.paddingLeft = '0'; }}
                      >
                        <ChevronRight size={13} style={{ flexShrink: 0 }} /> {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Opening Hours */}
              <div>
                <h4 style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 20, letterSpacing: 0.5 }}>Opening Hours</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { day: 'Mon – Fri', hours: '11:00 AM – 11:00 PM', open: true },
                    { day: 'Saturday', hours: '10:00 AM – 12:00 AM', open: true },
                    { day: 'Sunday', hours: '10:00 AM – 12:00 AM', open: true },
                    { day: 'Holidays', hours: '12:00 PM – 11:00 PM', open: true },
                  ].map(({ day, hours, open }) => (
                    <li key={day} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: '#d1d5db', fontSize: 13 }}>{day}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                        background: open ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                        color: open ? '#4ade80' : '#f87171',
                        border: `1px solid ${open ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                        whiteSpace: 'nowrap',
                      }}>{hours}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Contact */}
              <div>
                <h4 style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 20, letterSpacing: 0.5 }}>Contact Us</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { icon: <Phone size={15} />, label: '+91 98765 43210', href: 'tel:+919876543210', color: '#4ade80' },
                    { icon: <Mail size={15} />, label: 'hello@possystem.com', href: 'mailto:hello@possystem.com', color: '#60a5fa' },
                    { icon: <MapPin size={15} />, label: 'Downtown Area, City', href: '#', color: '#f87171' },
                  ].map(({ icon, label, href, color }) => (
                    <li key={label}>
                      <a href={href} style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 14, transition: 'color 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}
                      >
                        <span style={{
                          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                          background: `${color}18`, border: `1px solid ${color}30`,
                          color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                        }}>{icon}</span>
                        <span style={{ lineHeight: 1.5 }}>{label}</span>
                      </a>
                    </li>
                  ))}
                </ul>

                {/* Map badge */}
                <div style={{
                  marginTop: 24, padding: '12px 16px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MapPin size={16} color="#fff" />
                  </div>
                  <div>
                    <p style={{ color: '#fff', fontSize: 12, fontWeight: 700, margin: 0 }}>Find us on Maps</p>
                    <p style={{ color: '#6366f1', fontSize: 11, margin: 0, fontWeight: 600 }}>Get Directions →</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: 28, paddingBottom: 32,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}>
              <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
                © {new Date().getFullYear()} <strong style={{ color: '#94a3b8' }}>POS System</strong>. All rights reserved.
                <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                Built with ❤️ for restaurants
              </p>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map(link => (
                  <a key={link} href="#" style={{
                    color: '#64748b', fontSize: 13, textDecoration: 'none', transition: 'color 0.2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#a78bfa'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
                  >{link}</a>
                ))}
              </div>
            </div>
          </div>
        </footer>
        {/* ======================== END FOOTER ======================== */}

      </div>
    </div>
  );
};

export default LandingPage;
