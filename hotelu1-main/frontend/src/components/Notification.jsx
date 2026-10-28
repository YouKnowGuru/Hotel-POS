import React from 'react';

const Notification = ({ message, type, onClose }) => {
    // Use inline styles for background so dark-mode CSS overrides
    // on Tailwind bg-* classes can't make the toast transparent.
    const styles = {
        success: { backgroundColor: '#22c55e' }, // green-500
        error:   { backgroundColor: '#ef4444' }, // red-500
        warning: { backgroundColor: '#f59e0b' }, // amber-500
        info:    { backgroundColor: '#3b82f6' }, // blue-500
    };
    const style = styles[type] || styles.info;

	return (
		/* Toast: positioned above normal modals (z-[90]); all modals should use z-[100].
		   Stretched across narrow phones (left-4) so long messages don't push content off-screen. */
		<div
            role="status"
            className="fixed top-4 right-4 left-4 sm:left-auto z-[90] max-w-sm text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center justify-between gap-3 break-words text-sm"
            style={style}
        >
            <span className="min-w-0">{message}</span>
            <button onClick={onClose} aria-label="Dismiss" className="text-white font-bold shrink-0 text-lg leading-none">&times;</button>
        </div>
    );
};

export default Notification;
