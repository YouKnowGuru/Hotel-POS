import React from 'react';

const Notification = ({ message, type, onClose }) => {
    const bgColor =
        type === 'success' ? 'bg-green-500' :
        type === 'error'   ? 'bg-red-500'   :
        type === 'warning' ? 'bg-amber-500' :
                             'bg-blue-500';
	return (
		/* Toast: positioned above normal modals (z-[90]); all modals should use z-[100].
		   Stretched across narrow phones (left-4) so long messages don't push content off-screen (skill §5). */
		<div role="status" className={`fixed top-4 right-4 left-4 sm:left-auto z-[90] max-w-sm ${bgColor} text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center justify-between gap-3 break-words text-sm`}>
            <span className="min-w-0">{message}</span>
            <button onClick={onClose} aria-label="Dismiss" className="text-white font-bold shrink-0 text-lg leading-none">&times;</button>
        </div>
    );
};

export default Notification; 
