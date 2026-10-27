import React from 'react';

const NoAccessMessage = () => (
    <div className="flex items-center justify-center min-h-0 bg-red-50 text-red-700 text-xl sm:text-2xl font-bold rounded-lg shadow-inner p-6 text-center overflow-x-hidden">
        <p>Access Denied: You do not have permission to view this page.</p>
    </div>
);

export default NoAccessMessage; 
