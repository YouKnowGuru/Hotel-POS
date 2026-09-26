import React from 'react';

const NoAccessMessage = () => (
    <div className="flex items-center justify-center min-h-screen bg-red-50 text-red-700 text-2xl font-bold rounded-lg shadow-inner">
        <p>Access Denied: You do not have permission to view this page.</p>
    </div>
);

export default NoAccessMessage; 
