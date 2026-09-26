import React, { useState, useRef } from 'react';

const MenuItemForm = ({ onSave, onCancel, initialData = {}, locationSettings }) => {
    const [name, setName] = useState(initialData.name || '');
    const [category, setCategory] = useState(initialData.category || '');
    const [price, setPrice] = useState(initialData.price !== undefined ? initialData.price : '');
    const [description, setDescription] = useState(initialData.description || '');
    const [image, setImage] = useState(initialData.image || null);
    const [imagePreview, setImagePreview] = useState(initialData.image || null);
    const fileInputRef = useRef(null);

    // Compress image to reduce size before sending to backend
    const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Calculate new dimensions
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                    
                    // Create canvas and resize
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convert to compressed base64
                    const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedBase64);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // Compress image before setting
                const compressedImage = await compressImage(file, 800, 800, 0.7);
                setImage(compressedImage);
                setImagePreview(compressedImage);
            } catch (error) {
                console.error('Error compressing image:', error);
                // Fallback to original if compression fails
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImage(reader.result);
                    setImagePreview(reader.result);
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleRemoveImage = () => {
        setImage(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ ...initialData, name, category, price: parseFloat(price), description, image });
    };

    return (
        <div className="bg-white p-6 rounded-2xl">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Image Upload Section */}
                <div className="md:col-span-2 flex flex-col items-center mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-3">Item Image</label>
                    <div 
                        onClick={handleImageClick}
                        className="relative w-32 h-32 rounded-full border-4 border-orange-200 overflow-hidden cursor-pointer hover:border-orange-400 transition-all duration-300 bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center group"
                    >
                        {imagePreview ? (
                            <img 
                                src={imagePreview} 
                                alt="Preview" 
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="text-center">
                                <svg className="w-10 h-10 text-orange-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs text-orange-500 font-medium">Add Photo</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        accept="image/*"
                        className="hidden"
                    />
                    {imagePreview && (
                        <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="mt-2 text-sm text-red-500 hover:text-red-700 font-medium"
                        >
                            Remove Image
                        </button>
                    )}
                </div>
                <div>
                    <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">Name</label>
                    <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="shadow-sm border-2 border-orange-100 rounded-xl w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                        required
                        placeholder="Enter item name"
                    />
                </div>
                <div>
                    <label htmlFor="category" className="block text-gray-700 text-sm font-bold mb-2">Category</label>
                    <input
                        type="text"
                        id="category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="shadow-sm border-2 border-orange-100 rounded-xl w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                        required
                        placeholder="Enter category"
                    />
                </div>
                <div>
                    <label htmlFor="price" className="block text-gray-700 text-sm font-bold mb-2">Price (Nu. — BTN)</label>
                    <input
                        type="number"
                        id="price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        step="0.01"
                        className="shadow-sm border-2 border-orange-100 rounded-xl w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                        required
                        placeholder="0.00"
                    />
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">Description</label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows="3"
                        className="shadow-sm border-2 border-orange-100 rounded-xl w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                        placeholder="Enter item description (optional)"
                    ></textarea>
                </div>
                <div className="md:col-span-2 flex justify-end space-x-4 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl shadow-sm transition duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition duration-200"
                    >
                        {initialData.id ? 'Update Item' : 'Add Item'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default MenuItemForm; 
