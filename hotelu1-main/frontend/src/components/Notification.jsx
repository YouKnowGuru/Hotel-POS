import React from 'react';

const Notification = ({ message, type, onClose }) => {
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    return (
        <div className={`fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-md shadow-lg flex items-center justify-between z-50`}>
            <span>{message}</span>
            <button onClick={onClose} className="ml-4 text-white font-bold">&times;</button>
        </div>
    );
};

export default Notification; 
