import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Menu, X, Clock, Zap, MapPin, Users, QrCode, TrendingUp, Utensils, CreditCard } from 'lucide-react';
import QRCodeOrdering from './QRCodeOrdering';

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // Check for tableId in URL (from QR code scan)
  const params = new URLSearchParams(window.location.search);
  const tableId = params.get('tableId');

  useEffect(() => {
    // Handle scroll effect
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavigateToLogin = () => {
    navigate('/login');
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
        <img 
          src="/restaurant-bg.jpg" 
          alt="Restaurant Background" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10">
      {/* Navigation Bar */}
      <nav className={`fixed w-full top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-black bg-opacity-90 backdrop-blur-md shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className="text-3xl text-orange-400 restaurant-glow"><Utensils size={32} /></div>
              <div>
                <span className="text-3xl font-bold text-white restaurant-font restaurant-text-shadow">POS System</span>
                <p className="text-sm text-gray-300">Restaurant Management</p>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-white font-bold px-6 py-3 rounded-full text-sm bg-orange-500 bg-opacity-20 border border-orange-400 hover:bg-opacity-30 hover:text-orange-300 transition-all duration-300 transform hover:scale-105">Features</a>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={handleNavigateToLogin}
                className="px-6 py-2.5 rounded-lg border-2 border-orange-500 text-orange-400 font-semibold hover:bg-orange-500 hover:text-white transition"
              >
                Staff Login
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-black bg-opacity-90 backdrop-blur-md border-t border-gray-600 p-4 space-y-3">
              <a href="#features" className="block text-white font-bold py-2 font-medium">Features</a>
              <button
                onClick={() => { setMobileMenuOpen(false); handleNavigateToLogin(); }}
                className="w-full px-4 py-2.5 rounded-lg border-2 border-orange-500 text-orange-400 font-semibold hover:bg-orange-500 hover:text-white"
              >
                Staff Login
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-block bg-orange-500 bg-opacity-90 text-white px-4 py-1 rounded-full text-sm font-semibold mb-6">
                🍽️ Modern Restaurant Management
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                Delicious Food,<br/><span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">Modern Service</span>
              </h1>
              <p className="text-xl text-gray-200 mb-8 leading-relaxed">
                Experience seamless food ordering with our smart restaurant management system. Track your order in real-time and enjoy faster, better service.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleNavigateToLogin}
                  className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl border-2 border-orange-500 text-orange-400 font-bold text-lg hover:bg-orange-500 hover:text-white transition"
                >
                  <span>Staff Portal</span>
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* Right Visual */}
            <div className="relative hidden md:block">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-red-500 rounded-3xl blur-2xl opacity-30 animate-pulse"></div>
              <div className="relative bg-black bg-opacity-80 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-orange-400 border-opacity-30">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-orange-400 to-orange-500 bg-opacity-40 rounded-2xl p-6 text-center border border-orange-400 border-opacity-50 feature-card hover:scale-105 transition-all duration-300">
                      <div className="mb-3 text-orange-300 feature-icon-glow"><Zap size={28} /></div>
                      <p className="font-bold text-white text-lg feature-title-glow restaurant-font">Fast Service</p>
                    <p className="text-sm text-gray-300 mt-1 feature-description-font">Quick order processing</p>
                  </div>
                  <div className="bg-gradient-to-br from-red-400 to-red-500 bg-opacity-40 rounded-2xl p-6 text-center border border-red-400 border-opacity-50 feature-card hover:scale-105 transition-all duration-300">
                    <div className="mb-3 text-red-300 feature-icon-glow"><Utensils size={28} /></div>
                    <p className="font-bold text-white text-lg feature-title-glow restaurant-font">Fresh Food</p>
                    <p className="text-sm text-gray-300 mt-1 feature-description-font">Premium ingredients</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 bg-opacity-40 rounded-2xl p-6 text-center border border-yellow-400 border-opacity-50 feature-card hover:scale-105 transition-all duration-300">
                    <div className="mb-3 text-yellow-300 feature-icon-glow"><Clock size={28} /></div>
                    <p className="font-bold text-white text-lg feature-title-glow restaurant-font">Real-time Track</p>
                    <p className="text-sm text-gray-300 mt-1 feature-description-font">Live order updates</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-400 to-green-500 bg-opacity-40 rounded-2xl p-6 text-center border border-green-400 border-opacity-50 feature-card hover:scale-105 transition-all duration-300">
                    <div className="mb-3 text-green-300 feature-icon-glow"><CreditCard size={28} /></div>
                    <p className="font-bold text-white text-lg feature-title-glow restaurant-font">Easy Payment</p>
                    <p className="text-sm text-gray-300 mt-1 feature-description-font">Multiple options</p>
                  </div>
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
              { icon: <QrCode size={28} className="mx-auto text-white" />, title: 'QR Code Ordering', description: 'Scan and order directly from your table. No waiting, no paper menus.', bgColor: 'bg-gradient-to-br from-purple-500 to-purple-600', iconBg: 'bg-purple-400' },
              { icon: <Clock size={28} className="mx-auto text-white" />, title: 'Real-time Tracking', description: 'Track your order status from kitchen to table with live updates.', bgColor: 'bg-gradient-to-br from-blue-500 to-blue-600', iconBg: 'bg-blue-400' },
              { icon: <CreditCard size={28} className="mx-auto text-white" />, title: 'Easy Payments', description: 'Multiple payment options including cash, and card. Transparent billing.', bgColor: 'bg-gradient-to-br from-green-500 to-green-600', iconBg: 'bg-green-400' },
              { icon: <Utensils size={28} className="mx-auto text-white" />, title: 'Expert Kitchen', description: 'Our professional kitchen staff prepares each dish with care and quality.', bgColor: 'bg-gradient-to-br from-orange-500 to-orange-600', iconBg: 'bg-orange-400' },
              { icon: <Zap size={28} className="mx-auto text-white" />, title: 'Fast Service', description: 'Average preparation time under 15 minutes. Fastest service in the city.', bgColor: 'bg-gradient-to-br from-yellow-500 to-yellow-600', iconBg: 'bg-yellow-400' },
              { icon: <TrendingUp size={28} className="mx-auto text-white" />, title: 'Premium Quality', description: 'Only fresh ingredients. Hygiene and quality are our top priorities.', bgColor: 'bg-gradient-to-br from-red-500 to-red-600', iconBg: 'bg-red-400' },
            ].map((feature, idx) => (
              <div key={idx} className={`${feature.bgColor} rounded-xl shadow-md p-8 hover:shadow-xl transition text-center transform hover:scale-105`}>
                <div className={`${feature.iconBg} rounded-full p-4 w-20 h-20 flex items-center justify-center mx-auto mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-white opacity-90">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-orange-500 to-red-500">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Welcome to Our Restaurant</h2>
          <p className="text-xl mb-8 opacity-90">Experience modern restaurant management with our professional staff and quality service.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black bg-opacity-90 text-gray-300 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="text-2xl text-orange-600"><Utensils size={20} /></div>
                <span className="text-xl font-bold text-white">POS System</span>
              </div>
              <p>Delicious food, modern service, unforgettable experience.</p>
            </div>
            <div>
              <h4 className="font-bold text-orange-400 mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-orange-400 transition">Features</a></li>
                <li><a href="#about" className="hover:text-orange-400 transition">About</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-orange-400 mb-4">Hours</h4>
              <ul className="space-y-2">
                <li>Mon-Fri: 11am - 11pm</li>
                <li>Sat-Sun: 10am - 12am</li>
                <li>Holidays: 12pm - 11pm</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-orange-400 mb-4">Contact</h4>
              <ul className="space-y-2">
                <li>📞 +91 98765 43210</li>
                <li>📧 hello@possystem.com</li>
                <li>📍 Downtown Area</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 text-center">
            <p className="text-gray-400">&copy; 2026 POS System. All rights reserved.</p>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
};

export default LandingPage;
