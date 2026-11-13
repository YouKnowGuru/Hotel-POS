import React, { useState, useRef } from 'react';
import MenuImage from './MenuImage';

const MenuItemForm = ({ onSave, onCancel, initialData = {}, locationSettings }) => {
 const [name, setName] = useState(initialData.name || '');
 const [category, setCategory] = useState(initialData.category || '');
 const [price, setPrice] = useState(initialData.price !== undefined ? initialData.price : '');
 const [description, setDescription] = useState(initialData.description || '');
 const [image, setImage] = useState(initialData.image || null);
 const [imagePreview, setImagePreview] = useState(initialData.image || null);
 const [imageError, setImageError] = useState('');
 const fileInputRef = useRef(null);

 /* ── Upload normalisation ─────────────────────────────────────────────
    Admin photos arrive in every shape and size: 9:16 phone shots, 1:1
    crops, 3:1 banners, transparent PNGs, 10MB camera originals. We keep
    the ORIGINAL aspect ratio (the display layer decides how to fit it),
    but normalise everything else so no upload can break a card:
      - bounded file size + a hard output cap (menu images are base64 data
        URLs shipped to every guest's phone, and the API caps JSON at 5mb)
      - EXIF rotation honoured, so portrait iPhone shots aren't sideways
      - white underlay before JPEG/WebP encoding (transparent PNGs used to
        come out with black corners)
      - WebP when available, JPEG otherwise, with a shrink-and-retry loop
 */
 const MAX_FILE_BYTES = 12 * 1024 * 1024;
 const MAX_EDGE = 1200;
 const MAX_DATAURL_CHARS = 1400000; // ≈1MB of image bytes

 const readViaImageElement = (file, resolve, reject) => {
 const reader = new FileReader();
 reader.onerror = () => reject(new Error('Could not read that file. Please try another photo.'));
 reader.onload = (event) => {
 const img = new Image();
 img.onload = () => resolve({ image: img, revoke: () => {} });
 img.onerror = () => reject(new Error('That file is not a readable image.'));
 img.src = event.target.result;
 };
 reader.readAsDataURL(file);
 };

 const readAsImage = (file) => new Promise((resolve, reject) => {
 if (typeof createImageBitmap === 'function') {
 createImageBitmap(file, { imageOrientation: 'from-image' })
 .then(bmp => resolve({ image: bmp, revoke: () => bmp.close && bmp.close() }))
 .catch(() => readViaImageElement(file, resolve, reject));
 } else {
 readViaImageElement(file, resolve, reject);
 }
 });

 const compressImage = async (file) => {
 if (!file.type || !file.type.startsWith('image/')) {
 throw new Error('Please choose an image file (JPG, PNG, WebP, HEIC…).');
 }
 if (file.size > MAX_FILE_BYTES) {
 throw new Error('That photo is over 12 MB. Please choose a smaller one.');
 }
 const { image, revoke } = await readAsImage(file);
 try {
 const w = image.width || image.naturalWidth;
 const h = image.height || image.naturalHeight;
 if (!w || !h) throw new Error('That image has no readable dimensions.');
 const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
 let cw = Math.max(1, Math.round(w * scale));
 let ch = Math.max(1, Math.round(h * scale));

 const encode = (quality) => {
 const canvas = document.createElement('canvas');
 canvas.width = cw;
 canvas.height = ch;
 const ctx = canvas.getContext('2d');
 // White underlay: flattening a transparent PNG straight to JPEG
 // otherwise produces black corners.
 ctx.fillStyle = '#ffffff';
 ctx.fillRect(0, 0, cw, ch);
 ctx.drawImage(image, 0, 0, cw, ch);
 const webp = canvas.toDataURL('image/webp', quality);
 return webp.startsWith('data:image/webp')
 ? webp
 : canvas.toDataURL('image/jpeg', quality);
 };

 let out = encode(0.82);
 // Hard cap: a single photo must never make /api/menu heavy on mobile data.
 while (out.length > MAX_DATAURL_CHARS && cw > 320) {
 cw = Math.round(cw * 0.75);
 ch = Math.round(ch * 0.75);
 out = encode(0.72);
 }
 return out;
 } finally {
 revoke();
 }
 };

 const handleImageChange = async (e) => {
 const file = e.target.files && e.target.files[0];
 if (!file) return;
 setImageError('');
 try {
 const compressedImage = await compressImage(file);
 setImage(compressedImage);
 setImagePreview(compressedImage);
 } catch (error) {
 console.error('Error compressing image:', error);
 setImageError(error.message || 'Could not process that image. Please try another one.');
 if (fileInputRef.current) fileInputRef.current.value = '';
 }
 };

 const handleImageClick = () => {
 fileInputRef.current?.click();
 };

 const handleRemoveImage = () => {
 setImage(null);
 setImagePreview(null);
 setImageError('');
 if (fileInputRef.current) {
 fileInputRef.current.value = '';
 }
 };

 const handleSubmit = (e) => {
 e.preventDefault();
 onSave({ ...initialData, name, category, price: parseFloat(price), description, image });
 };

 return (
 <div className="bg-white p-4 sm:p-6 rounded-2xl">
 <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Image Upload Section */}
 <div className="md:col-span-2 flex flex-col items-center mb-4">
 <label className="block text-gray-700 text-sm font-bold mb-3">Item Image</label>
 <div 
 onClick={handleImageClick}
 className="relative w-32 h-32 rounded-full border-4 border-indigo-200 overflow-hidden cursor-pointer hover:border-indigo-400 transition-all duration-300 bg-indigo-50 flex items-center justify-center group"
 >
 {imagePreview ? (
 <MenuImage src={imagePreview} alt="Preview" ratio="1 / 1"
 className="mi-round" style={{ width: '100%', height: '100%' }} />
 ) : (
 <div className="text-center">
 <svg className="w-10 h-10 text-indigo-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
 </svg>
 <span className="text-xs text-indigo-500 font-medium">Add Photo</span>
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
 {imageError && (
 <p role="alert" className="mt-2 max-w-xs text-center text-sm font-medium text-red-600 dark:text-red-400">{imageError}</p>
 )}
 <p className="mt-2 max-w-xs text-center text-xs text-gray-500 dark:text-gray-400">
 Any size or shape of photo works — it will fit the menu card automatically on every screen.
 </p>
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
 className="shadow-sm border-2 border-indigo-100 rounded-xl w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
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
 className="shadow-sm border-2 border-indigo-100 rounded-xl w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
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
 className="shadow-sm border-2 border-indigo-100 rounded-xl w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
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
 className="shadow-sm border-2 border-indigo-100 rounded-xl w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
 placeholder="Enter item description (optional)"
 ></textarea>
 </div>
 <div className="md:col-span-2 flex flex-col sm:flex-row justify-end gap-3 sm:space-x-4 pt-4 border-t border-gray-100">
 <button
 type="button"
 onClick={onCancel}
 className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 sm:px-6 rounded-xl shadow-sm transition duration-200"
 >
 Cancel
 </button>
 <button
 type="submit"
 className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 sm:px-6 rounded-xl shadow-lg transition duration-200"
 >
 {initialData.id ? 'Update Item' : 'Add Item'}
 </button>
 </div>
 </form>
 </div>
 );
};

export default MenuItemForm; 
