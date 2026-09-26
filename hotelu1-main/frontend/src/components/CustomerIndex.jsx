import React, { useState, useEffect } from 'react';
import QRCodeOrdering from './QRCodeOrdering';
import Notification from './Notification';
import { Utensils, Zap, CreditCard } from 'lucide-react';

const RestaurantIndexPage = ({ onLoginClick }) => {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-white shadow-lg sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-2xl font-bold text-orange-600"><Utensils size={22} /> POS System</div>
          <button
            onClick={onLoginClick}
            className="btn-gradient px-6 py-2"
          >
            Staff Login
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">Welcome to POS System</h1>
          <p className="text-xl text-gray-600">Delicious food, fantastic service, and unforgettable experience</p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-5xl mb-4 text-orange-500"><QrCode size={36} /></div>
            <h3 className="text-2xl font-bold mb-2">Easy Ordering</h3>
            <p className="text-gray-600">Scan QR code at your table for instant menu and ordering</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-5xl mb-4 text-orange-500"><Zap size={36} /></div>
            <h3 className="text-2xl font-bold mb-2">Fast Service</h3>
            <p className="text-gray-600">Real-time order tracking and quick delivery to your table</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-5xl mb-4 text-green-500"><CreditCard size={36} /></div>
            <h3 className="text-2xl font-bold mb-2">Easy Payment</h3>
            <p className="text-gray-600">Multiple payment options including cards, and cash</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-12">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">How to Order</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-orange-600">1</div>
              <h4 className="font-bold mb-2">Scan QR</h4>
              <p className="text-gray-600">Scan the QR code at your table</p>
            </div>
            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-orange-600">2</div>
              <h4 className="font-bold mb-2">Browse Menu</h4>
              <p className="text-gray-600">View all available dishes and specialties</p>
            </div>
            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-orange-600">3</div>
              <h4 className="font-bold mb-2">Add Items</h4>
              <p className="text-gray-600">Select items and add to cart</p>
            </div>
            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-orange-600">4</div>
              <h4 className="font-bold mb-2">Pay & Enjoy</h4>
              <p className="text-gray-600">Complete payment and enjoy your meal</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-600">
          <p>Scan QR code at your table or contact staff for assistance</p>
        </div>
      </div>
    </div>
  );
};

const CustomerIndex = ({ locationSettings }) => {
  const params = new URLSearchParams(window.location.search);
  const tableId = params.get('tableId');
  const [showLogin, setShowLogin] = useState(false);

  // If tableId is present, show menu/ordering page
  if (tableId) {
    return <QRCodeOrdering locationSettings={locationSettings} tableId={tableId} />;
  }

  // If no tableId, show restaurant index
  if (showLogin) {
    // Redirect to login page
    window.location.href = '/login';
    return null;
  }

  return <RestaurantIndexPage onLoginClick={() => setShowLogin(true)} />;
};

export default CustomerIndex;
