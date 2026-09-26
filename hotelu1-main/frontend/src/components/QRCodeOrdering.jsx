import React, { useState, useEffect, useMemo } from 'react';
import { UtensilsCrossed, Sparkles } from 'lucide-react';
import SimpleMenu from './SimpleMenu';
import CustomerOrderTracker from './CustomerOrderTracker';
import Notification from './Notification';
import BrandMark from './BrandMark';
import useCurrency from '../hooks/useCurrency';
import { loadBranding } from '../utils/branding';

/**
 * Public QR-ordering experience.
 *
 * Design goals (ui-ux-pro-max):
 *  - Hero header with the restaurant's brand + table badge so the
 *    customer immediately knows where they are (context, trust).
 *  - Sticky, compact header that stays reachable while scrolling the
 *    menu without eating precious phone screen space.
 *  - Fast: branding is read synchronously from localStorage; the hero
 *    is pure CSS gradients — zero extra network requests before the
 *    menu paints.
 *  - Fully responsive: 1-col phones → 2-col tablets → max-width shell
 *    on desktop, with dvh-aware min-height for mobile browser chrome.
 */
const QRCodeOrdering = ({ locationSettings, onOrderPlacedWithId, tableId: propTableId }) => {
    const { format: fmt } = useCurrency(locationSettings);
    const [tableId, setTableId] = useState('Unknown Table/Takeaway');
    const [currentOrderId, setCurrentOrderId] = useState(null);
    const [notification, setNotification] = useState(null);
    const [showTracker, setShowTracker] = useState(false);
    const [branding, setBranding] = useState(() => loadBranding());

    useEffect(() => {
        // Get tableId from props first, then URL
        if (propTableId) {
            setTableId(propTableId);
        } else {
            const params = new URLSearchParams(window.location.search);
            const idFromUrl = params.get('tableId');
            if (idFromUrl) {
                setTableId(idFromUrl);
            }
        }
    }, [propTableId]);

    // Live branding updates (admin saved a new logo/name while a
    // customer has the page open).
    useEffect(() => {
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
            duration: 6000
        });
        if (onOrderPlacedWithId) {
            onOrderPlacedWithId(order.id);
        }
        // Stay on menu so customer can add more items (no redirect)
    };

    const handleNewOrder = () => {
        setCurrentOrderId(null);
        setShowTracker(false);
        setNotification(null);
    };

    return (
        <div className="min-h-[100dvh] flex flex-col" style={{ background: 'var(--app-bg, #F8FAFC)' }}>
            {notification && (
                <Notification
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                    duration={notification.duration}
                />
            )}

            {/* ── Hero header (sticky, brand + table context) ── */}
            <header
                className="sticky top-0 z-40"
                style={{
                    background: 'linear-gradient(135deg, #0A1628 0%, #14306B 55%, #1E3A8A 100%)',
                    boxShadow: '0 4px 24px rgba(10, 22, 40, 0.35)',
                }}
            >
                <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
                    <BrandMark
                        size={34}
                        iconSize={16}
                        light
                        nameClass="text-sm sm:text-base font-bold"
                        taglineClass="text-[9px] sm:text-[10px]"
                    />
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
                <div
                    className="h-px"
                    style={{
                        background: 'linear-gradient(90deg, transparent, rgba(212,160,23,0.55), transparent)',
                    }}
                />
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

            {/* ── Footer ── */}
            <footer className="py-4 text-center text-[10px]" style={{ color: 'var(--text-muted, #94A3B8)' }}>
                Powered by {branding.siteName}
            </footer>
        </div>
    );
};

export default QRCodeOrdering;
