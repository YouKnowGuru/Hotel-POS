import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { enrichOrderWithTotals, fetchAndCacheGlobalSettings } from '../utils/orderTotals';
import { getLocationSettingsForCountry } from '../utils/currency';
import useCurrency from '../hooks/useCurrency';

const OrderConfirmation = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { tableId } = useParams();
    const [settingsReady, setSettingsReady] = useState(false);

    const [orderData, setOrderData] = useState(() => {
        const navState = location.state?.orderData;
        if (navState) {
            localStorage.setItem('lastOrder', JSON.stringify(navState));
            return navState;
        }
        const saved = localStorage.getItem('lastOrder');
        return saved ? JSON.parse(saved) : null;
    });

    const [locationSettings, setLocationSettings] = useState(() =>
        getLocationSettingsForCountry(localStorage.getItem('posCountry') || 'Bhutan')
    );

    useEffect(() => {
        const syncCountry = () => {
            setLocationSettings(
                getLocationSettingsForCountry(localStorage.getItem('posCountry') || 'Bhutan')
            );
        };
        window.addEventListener('storage', syncCountry);
        return () => window.removeEventListener('storage', syncCountry);
    }, []);

    useEffect(() => {
        fetchAndCacheGlobalSettings().then(() => setSettingsReady(true));
    }, []);

    useEffect(() => {
        if (!orderData) {
            navigate(tableId ? `/menu/${tableId}` : '/customer');
        }
    }, [orderData, navigate, tableId]);

    const { format: fmt } = useCurrency(locationSettings);

    if (!orderData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    const { order, token, items, timestamp, orderId } = orderData;
    const orderDate = timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString();
    const lineItems = items || order?.items || [];
    const enriched = settingsReady
        ? enrichOrderWithTotals({ ...order, items: lineItems, subtotal: order?.subtotal })
        : null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 py-4 px-4">
            <div className="max-w-md mx-auto">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-center mb-6 shadow-lg">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Order Confirmed!</h1>
                    <p className="text-orange-100">Your order has been placed successfully</p>
                </div>

                {!tableId && (
                    <div className="bg-white rounded-2xl p-6 mb-4 shadow-md border border-orange-100">
                        <div className="text-center mb-4">
                            <p className="text-gray-500 text-sm uppercase tracking-wide mb-2">Your Order Token</p>
                            <div className="bg-gradient-to-r from-orange-100 to-red-100 rounded-xl p-6">
                                <p className="text-5xl font-bold text-orange-600 tracking-wider">{token || order?.token || 'N/A'}</p>
                            </div>
                            <p className="text-gray-500 text-sm mt-3">Show this token at the counter</p>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl p-6 mb-4 shadow-md border border-orange-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">Order Details</h2>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Order ID</span>
                            <span className="font-semibold text-gray-800">#{orderId || order?.id}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Date & Time</span>
                            <span className="font-semibold text-gray-800">{orderDate}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Status</span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Pending
                            </span>
                        </div>
                        {tableId && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">Table</span>
                                <span className="font-semibold text-gray-800">#{tableId}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 mb-4 shadow-md border border-orange-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">Items Ordered</h2>
                    <div className="space-y-3">
                        {lineItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                                <div>
                                    <p className="font-semibold text-gray-800">{item.name}</p>
                                    <p className="text-xs text-gray-500">{item.qty || item.quantity}x {fmt(item.price)}</p>
                                </div>
                                <span className="font-semibold text-orange-600">
                                    {fmt(item.price * (item.qty || item.quantity || 1))}
                                </span>
                            </div>
                        ))}
                    </div>

                    {enriched && (
                        <div className="mt-3 space-y-1">
                            <div className="flex justify-between items-center text-sm py-1">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="font-medium text-gray-800">{fmt(enriched.subtotal)}</span>
                            </div>
                            {enriched.discountPercent > 0 && (
                                <div className="flex justify-between items-center text-sm py-1">
                                    <span className="text-gray-600">Discount ({enriched.discountPercent}%)</span>
                                    <span className="font-medium text-green-600">-{fmt(enriched.discountAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-sm py-1">
                                <span className="text-gray-600">Tax ({enriched.taxPercent}%)</span>
                                <span className="font-medium text-gray-800">+{fmt(enriched.taxAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t-2 border-gray-200 mt-2">
                                <span className="text-lg font-bold text-gray-800">Total Amount</span>
                                <span className="text-2xl font-bold text-orange-600">{fmt(enriched.total)}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-blue-50 rounded-2xl p-6 mb-4 border border-blue-200">
                    <p className="text-sm text-blue-700">
                        {tableId ? (
                            <>Your order will be served at <strong>Table #{tableId}</strong>. Please wait at your table.</>
                        ) : (
                            <>Show token <strong>{token || order?.token}</strong> at the counter to collect your order.</>
                        )}
                    </p>
                </div>

                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="w-full bg-white border-2 border-orange-200 text-orange-600 font-bold py-3 rounded-xl hover:bg-orange-50"
                    >
                        Print Receipt
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(tableId ? `/menu/${tableId}` : '/customer')}
                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 rounded-xl"
                    >
                        Order More Items
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderConfirmation;
