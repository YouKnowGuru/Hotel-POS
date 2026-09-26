import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings as SettingsIcon,
  Sliders,
  Receipt,
  CreditCard,
  Palette,
  Save,
  Percent,
  Tag,
  Check,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { getAPI_URL } from '../utils/api';
import { useTheme, applyAppearance } from '../contexts/ThemeContext';
import {
  loadBranding,
  saveBranding,
  fetchBrandingFromServer,
  resetBranding,
  applyDocumentBranding,
  DEFAULT_BRANDING,
} from '../utils/branding';

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

const TABS = [
  {
    id: 'general',
    label: 'General Parameters',
    sub: 'Identity, contact data & timezone.',
    Icon: Sliders,
  },
  {
    id: 'billing',
    label: 'Billing & Taxation',
    sub: 'Default GST, invoice formats & print rules.',
    Icon: Receipt,
  },
  {
    id: 'payments',
    label: 'Payment QR',
    sub: 'Customer checkout payment QR image.',
    Icon: CreditCard,
  },
  {
    id: 'branding',
    label: 'Branding',
    sub: 'Site name, tagline, logo & favicon.',
    Icon: ImageIcon,
  },
  {
    id: 'appearance',
    label: 'Appearance & Layout',
    sub: 'Active color systems & grid spacing.',
    Icon: Palette,
  },
];

const TIMEZONES = [
  { v: 'GMT+5:30', l: 'GMT+5:30 (Kolkata)' },
  { v: 'GMT+0:00', l: 'GMT+0:00 (London)' },
  { v: 'GMT-5:00', l: 'GMT-5:00 (New York)' },
  { v: 'GMT-8:00', l: 'GMT-8:00 (Los Angeles)' },
  { v: 'GMT+4:00', l: 'GMT+4:00 (Dubai)' },
];

const CURRENCIES = [
  { v: 'BTN', l: 'BTN (Nu.)' },
];

const STORE_KEY = 'systemSettingsExtended_v1';
const loadExtended = () => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const saveExtended = (obj) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(obj));
  } catch {
    /* noop */
  }
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [isLoaded, setIsLoaded] = useState(false);
  const [toast, setToast] = useState(null);

  // --- General + extended (localStorage) ---
  const initialExt = useMemo(() => loadExtended(), []);
  const [general, setGeneral] = useState({
    restaurantName: initialExt.restaurantName || 'Flavors of Bhutan',
    contactPhone: initialExt.contactPhone || '+975 17 123 456',
    timezone: initialExt.timezone || 'GMT+6:00',
    currency: 'BTN',
    address: initialExt.address || 'Thimphu, Bhutan',
    bstNo: initialExt.bstNo || '',
  });
  const [appearance, setAppearance] = useState({
    themeColor: initialExt.themeColor || 'orange',
    layoutDensity: initialExt.layoutDensity || 'comfortable',
  });
  const [branding, setBranding] = useState(() => loadBranding());

  // Converge on the admin's saved branding from the server on mount.
  // If no branding was ever saved, inherit the real restaurant name
  // from General settings so the Branding tab reflects the business.
  useEffect(() => {
    fetchBrandingFromServer().then((b) => {
      if (b) {
        setBranding(b);
      } else {
        setBranding((prev) => {
          if (prev.siteName !== 'Hotel POS' || prev.tagline !== 'Management Suite') return prev;
          const generalName = String(initialExt.restaurantName || '').trim();
          return generalName
            ? { ...prev, siteName: generalName.slice(0, 40), tagline: '' }
            : prev;
        });
      }
    });
  }, []);
  // --- Billing (tax/discount) — preserves EXACT existing API behavior ---
  const [billing, setBilling] = useState({ taxPercent: 5, discountPercent: 0 });
  const [billingDraft, setBillingDraft] = useState({
    taxPercent: 5,
    discountPercent: 0,
  });
  const [billingDirty, setBillingDirty] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Existing fetch behavior — same endpoints as Sidebar used previously
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${getAPI_URL()}/api/settings`);
        if (res.ok) {
          const data = await res.json();
          const s = {
            taxPercent: data.taxPercent ?? 5,
            discountPercent: data.discountPercent ?? 0,
          };
          setBilling(s);
          setBillingDraft(s);
          localStorage.setItem('globalTaxDiscount', JSON.stringify(s));
        }
      } catch (e) {
        const saved = localStorage.getItem('globalTaxDiscount');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setBilling(parsed);
            setBillingDraft(parsed);
          } catch {
            /* ignore */
          }
        }
      }
    };
    fetchSettings();
  }, []);

  const showToast = (msg, kind = 'success') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2200);
  };

  // --- save handlers ---
  const handleSaveGeneral = () => {
    const next = { ...loadExtended(), ...general };
    saveExtended(next);
    // Best-effort: publish the restaurant name server-side so customer
    // devices (QR menu) inherit the real business name in branding.
    fetch(`${getAPI_URL()}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      },
      body: JSON.stringify({
        key: 'restaurantName',
        value: general.restaurantName,
        description: 'Public restaurant name for branding',
      }),
    }).catch(() => {});
    showToast('General settings saved');
  };

  const handleSaveAppearance = () => {
    const next = { ...loadExtended(), ...appearance };
    saveExtended(next);
    window.dispatchEvent(new Event('appearance-changed'));
    showToast('Appearance settings saved');
  };

  // EXACT existing tax/discount save logic
  const handleSaveBilling = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${getAPI_URL()}/api/settings/batch`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(billingDraft),
      });
      if (res.ok) {
        setBilling(billingDraft);
        localStorage.setItem('globalTaxDiscount', JSON.stringify(billingDraft));
        setBillingDirty(false);
        showToast('Tax & discount preferences saved');
      } else {
        showToast('Could not save preferences', 'error');
      }
    } catch (e) {
      showToast('Could not save preferences', 'error');
    }
  };

  /* ---------------------- render ---------------------- */
  const activeTabMeta = TABS.find((t) => t.id === activeTab);

  return (
    <div
      className={`px-4 sm:px-6 lg:px-8 py-6 min-h-screen bg-[#F7F7F8] transition-opacity duration-500 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure parameters, printer variables, taxation settings, and global
          defaults
        </p>
      </div>

      {/* Two-pane layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Tabs panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 h-fit">
          <ul className="space-y-1.5">
            {TABS.map((t) => {
              const active = activeTab === t.id;
              const Icon = t.Icon;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setActiveTab(t.id)}
                    className={`w-full flex items-start gap-3 px-3 py-3 rounded-2xl text-left transition-all ${
                      active
                        ? 'bg-orange-50 border border-orange-100'
                        : 'border border-transparent hover:bg-orange-50/40'
                    }`}
                  >
                    <span
                      className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                        active
                          ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-sm shadow-orange-200/60'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span
                        className={`block text-sm font-semibold ${
                          active ? 'text-orange-600' : 'text-gray-800'
                        }`}
                      >
                        {t.label}
                      </span>
                      <span className="block text-[11px] text-gray-500 mt-0.5 leading-snug">
                        {t.sub}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <SettingsIcon className="w-3.5 h-3.5 text-gray-400" />
            <h2 className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
              {activeTabMeta?.label || 'Settings'}
            </h2>
          </div>

          {activeTab === 'general' && (
            <GeneralForm
              value={general}
              onChange={setGeneral}
              onSave={handleSaveGeneral}
            />
          )}

          {activeTab === 'billing' && (
            <BillingForm
              draft={billingDraft}
              setDraft={setBillingDraft}
              billing={billing}
              dirty={billingDirty}
              setDirty={setBillingDirty}
              onSave={handleSaveBilling}
            />
          )}

          {activeTab === 'payments' && <PaymentsForm />}

          {activeTab === 'branding' && (
            <BrandingForm
              value={branding}
              onChange={setBranding}
              onSaved={(b) => {
                applyDocumentBranding(b);
                showToast('Branding saved — applied across the site');
              }}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {activeTab === 'appearance' && (
            <AppearanceForm
              value={appearance}
              onChange={setAppearance}
              onSave={handleSaveAppearance}
            />
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold ${
              toast.kind === 'error'
                ? 'bg-rose-500 text-white'
                : 'bg-emerald-500 text-white'
            }`}
          >
            <Check className="w-4 h-4" />
            {toast.msg}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn .2s ease-out both; }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Reusable bits                                                      */
/* ------------------------------------------------------------------ */

const Field = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-bold tracking-widest text-gray-500 uppercase mb-2">
      {label}
    </label>
    {children}
  </div>
);

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-orange-100 bg-orange-50/40 focus:bg-white focus:border-orange-300 focus:ring-2 focus:ring-orange-200 text-sm text-gray-800 placeholder-gray-400 transition';

const SaveBar = ({ onSave, disabled = false, hint = 'Press save to sync changes across system nodes' }) => (
  <div className="mt-8 pt-5 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
    <p className="text-xs text-gray-500">{hint}</p>
    <button
      onClick={onSave}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm ${
        disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-md hover:shadow-orange-200/50 hover:-translate-y-0.5'
      }`}
    >
      <Save className="w-4 h-4" />
      SAVE PREFERENCES
    </button>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Forms                                                              */
/* ------------------------------------------------------------------ */

const GeneralForm = ({ value, onChange, onSave }) => {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Restaurant Name">
          <input
            type="text"
            value={value.restaurantName}
            onChange={(e) => set('restaurantName', e.target.value)}
            className={inputCls}
            placeholder="Restaurant name"
          />
        </Field>
        <Field label="Contact Phone">
          <input
            type="text"
            value={value.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
            className={inputCls}
            placeholder="+91 90000 00000"
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Restaurant Address">
            <textarea
              value={value.address}
              onChange={(e) => set('address', e.target.value)}
              className={`${inputCls} min-h-[68px] resize-y`}
              placeholder="Opp. Samatha College, Sector-6, MVP Colony, Visakhapatnam"
            />
            <p className="text-[11px] text-gray-400 mt-1.5">
              Prints at the top of every customer bill
            </p>
          </Field>
        </div>
        <Field label="GSTIN / TPN">
          <input
            type="text"
            value={value.bstNo}
            onChange={(e) => set('bstNo', e.target.value.toUpperCase())}
            className={inputCls}
            placeholder="e.g. 1234567"
          />
        </Field>
        <Field label="Local Timezone">
          <select
            value={value.timezone}
            onChange={(e) => set('timezone', e.target.value)}
            className={inputCls}
          >
            {TIMEZONES.map((t) => (
              <option key={t.v} value={t.v}>
                {t.l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Currency Parameter">
          <select
            value={value.currency}
            onChange={(e) => set('currency', e.target.value)}
            className={inputCls}
          >
            {CURRENCIES.map((c) => (
              <option key={c.v} value={c.v}>
                {c.l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <SaveBar onSave={onSave} />
    </div>
  );
};

const BillingForm = ({ draft, setDraft, billing, dirty, setDirty, onSave }) => {
  const set = (k, v) => {
    setDraft({ ...draft, [k]: v });
    setDirty(true);
  };
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Default Tax (%)">
          <div className="relative">
            <Percent className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={draft.taxPercent}
              onChange={(e) => set('taxPercent', parseFloat(e.target.value) || 0)}
              className={`${inputCls} pl-9`}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            Applied to subtotals across all order types
          </p>
        </Field>
        <Field label="Default Discount (%)">
          <div className="relative">
            <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={draft.discountPercent}
              onChange={(e) =>
                set('discountPercent', parseFloat(e.target.value) || 0)
              }
              className={`${inputCls} pl-9`}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            Applies before tax on every new bill
          </p>
        </Field>
      </div>

      {/* Current preview */}
      <div className="mt-6 bg-orange-50/50 border border-orange-100 rounded-2xl p-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-orange-600">
            CURRENTLY APPLIED TAX
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {billing.taxPercent}%
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold tracking-widest text-orange-600">
            CURRENTLY APPLIED DISCOUNT
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {billing.discountPercent}%
          </p>
        </div>
      </div>

      <SaveBar
        onSave={onSave}
        disabled={!dirty}
        hint={
          dirty
            ? 'Unsaved changes — press save to apply'
            : 'No pending changes'
        }
      />
    </div>
  );
};

const PaymentsForm = () => {
  const [uploadedQr, setUploadedQr] = useState('');
  const [qrMessage, setQrMessage] = useState('');
  const [qrSaving, setQrSaving] = useState(false);

  useEffect(() => {
    fetch(`${getAPI_URL()}/api/settings?key=payment_qr_image`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setUploadedQr(typeof data?.value === 'string' ? data.value : ''))
      .catch(() => {});
  }, []);

  const uploadPaymentQr = (file) => {
    setQrMessage('');
    if (!file) return;
    // The image is stored in the existing settings text field. QR images are
    // naturally small; keeping this cap prevents oversized database records.
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 45 * 1024) {
      setQrMessage('Use a PNG, JPG, or WebP payment QR image smaller than 45 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const image = String(reader.result);
      setQrSaving(true);
      try {
        const response = await fetch(`${getAPI_URL()}/api/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
          body: JSON.stringify({ key: 'payment_qr_image', value: image, description: 'Customer payment QR image' }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not save payment QR');
        setUploadedQr(image); setQrMessage('Payment QR uploaded. Customers will see it at checkout.');
      } catch (error) { setQrMessage(error.message || 'Could not upload payment QR.'); }
      finally { setQrSaving(false); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <p className="font-bold text-emerald-900">Customer checkout payment QR</p>
        <p className="mt-1 text-sm text-emerald-800">Upload the QR image customers should scan before placing an order. This image is shown on every QR-menu checkout.</p>
        <div className="mt-3 flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="h-28 w-28 rounded-xl border border-emerald-200 bg-white flex items-center justify-center overflow-hidden">
            {uploadedQr ? <img src={uploadedQr} alt="Uploaded payment QR" className="h-full w-full object-contain p-1" /> : <span className="text-xs text-gray-400 text-center px-2">No QR uploaded</span>}
          </div>
          <div className="flex-1">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadPaymentQr(e.target.files?.[0])}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:font-semibold file:text-white" />
            <p className="mt-2 text-xs text-gray-500">PNG, JPG, or WebP; maximum 45 KB. Use a clean, square QR image.</p>
            {qrMessage && <p className={`mt-2 text-sm ${qrMessage.startsWith('Payment QR uploaded') ? 'text-emerald-700' : 'text-rose-600'}`}>{qrSaving ? 'Uploading…' : qrMessage}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Branding form — site name, tagline, logo, favicon                   */
/* ------------------------------------------------------------------ */

const MAX_LOGO_KB = 120;

const readImageFile = (file, maxKB) =>
  new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected'));
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      return reject(new Error('Use a PNG, JPG, WebP, or SVG image.'));
    }
    if (file.size > maxKB * 1024) {
      return reject(new Error(`Image must be smaller than ${maxKB} KB.`));
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });

const BrandingForm = ({ value, onChange, onSaved, onError }) => {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const [logoBusy, setLogoBusy] = useState(false);
  const [faviconBusy, setFaviconBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const markStyle = (shape) => ({
    borderRadius:
      shape === 'circle' ? '9999px' : shape === 'square' ? '4px' : '12px',
  });

  const handleLogo = async (file) => {
    if (!file) return;
    setLogoBusy(true);
    try {
      const dataUrl = await readImageFile(file, MAX_LOGO_KB);
      set('logo', dataUrl);
      onSaved?.({ ...value, logo: dataUrl });
    } catch (e) {
      onError?.(e.message || 'Could not read the logo image.');
    } finally {
      setLogoBusy(false);
    }
  };

  const handleFavicon = async (file) => {
    if (!file) return;
    setFaviconBusy(true);
    try {
      const dataUrl = await readImageFile(file, 64);
      set('favicon', dataUrl);
      onSaved?.({ ...value, favicon: dataUrl });
    } catch (e) {
      onError?.(e.message || 'Could not read the favicon image.');
    } finally {
      setFaviconBusy(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveBranding(value);
      onChange(saved);
      onSaved?.(saved);
    } catch (e) {
      onError?.(e.message || 'Could not save branding.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const clean = await resetBranding();
      onChange(clean);
      applyDocumentBranding(clean);
      onSaved?.(clean);
    } catch (e) {
      onError?.(e.message || 'Could not reset branding.');
    } finally {
      setResetting(false);
    }
  };

  const nameDirty =
    value.siteName !== DEFAULT_BRANDING.siteName ||
    value.tagline !== DEFAULT_BRANDING.tagline ||
    !!value.logo ||
    !!value.favicon ||
    value.logoShape !== DEFAULT_BRANDING.logoShape ||
    value.showTagline !== DEFAULT_BRANDING.showTagline;

  return (
    <div>
      {/* ── Live preview ── */}
      <div
        className="mb-5 rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, #0A1628 0%, #1E3A8A 100%)',
        }}
      >
        <p className="text-[10px] font-bold tracking-widest mb-4" style={{ color: 'rgba(212,160,23,0.7)' }}>
          LIVE PREVIEW — SIDEBAR BRAND
        </p>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 flex items-center justify-center shrink-0 overflow-hidden"
            style={{
              ...markStyle(value.logoShape),
              background: value.logo
                ? 'rgba(255,255,255,0.95)'
                : 'linear-gradient(135deg, #D4A017 0%, #A16207 100%)',
            }}
          >
            {value.logo ? (
              <img src={value.logo} alt="Logo preview" className="w-full h-full object-contain p-1" />
            ) : (
              <span className="text-white text-xl font-bold">🔥</span>
            )}
          </div>
          <div className="min-w-0">
            <p
              className="text-lg font-bold text-white leading-tight font-brand truncate"
              style={{ fontFamily: '"Playfair Display SC", Georgia, serif' }}
            >
              {value.siteName || DEFAULT_BRANDING.siteName}
            </p>
            {value.showTagline && value.tagline ? (
              <p className="text-[11px] leading-tight tracking-widest uppercase truncate" style={{ color: '#D4A017' }}>
                {value.tagline}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Site name">
          <input
            type="text"
            value={value.siteName}
            onChange={(e) => set('siteName', e.target.value)}
            className={inputCls}
            placeholder={DEFAULT_BRANDING.siteName}
            maxLength={40}
          />
          <p className="text-[11px] text-gray-500 mt-1.5">
            Shown in the sidebar, login page and browser tab.
          </p>
        </Field>

        <Field label="Tagline">
          <input
            type="text"
            value={value.tagline}
            onChange={(e) => set('tagline', e.target.value)}
            className={inputCls}
            placeholder={DEFAULT_BRANDING.tagline}
            maxLength={60}
          />
          <p className="text-[11px] text-gray-500 mt-1.5">
            Small line under the site name (e.g. “Management Suite”).
          </p>
        </Field>
      </div>

      {/* ── Logo shape ── */}
      <div className="mt-5">
        <Field label="Logo shape">
          <div className="flex gap-2">
            {[
              { id: 'rounded', label: 'Rounded' },
              { id: 'circle', label: 'Circle' },
              { id: 'square', label: 'Square' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => set('logoShape', id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  value.logoShape === id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {/* ── Logo upload ── */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-900">Site logo</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Sidebar, mobile bar & login. PNG/JPG/WebP/SVG up to {MAX_LOGO_KB} KB.
          </p>
          <div className="mt-3 flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
              {value.logo ? (
                <img src={value.logo} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <span className="text-[10px] text-gray-400 text-center px-1">Default</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => handleLogo(e.target.files?.[0])}
                  disabled={logoBusy}
                />
                <span className="px-3 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold cursor-pointer hover:bg-orange-600 transition disabled:opacity-60">
                  {logoBusy ? 'Reading…' : value.logo ? 'Replace logo' : 'Upload logo'}
                </span>
              </label>
              {value.logo && (
                <button
                  type="button"
                  onClick={() => {
                    set('logo', '');
                    onSaved?.({ ...value, logo: '' });
                  }}
                  className="block mt-2 text-[11px] text-gray-400 hover:text-rose-500 transition"
                >
                  Remove logo (use default)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Favicon upload ── */}
        <div className="rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-900">Browser tab icon (favicon)</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Square image, 64×64+ recommended. Up to 64 KB.
          </p>
          <div className="mt-3 flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
              {value.favicon ? (
                <img src={value.favicon} alt="Favicon" className="w-full h-full object-contain" />
              ) : (
                <span className="text-[10px] text-gray-400 text-center px-1">Default</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => handleFavicon(e.target.files?.[0])}
                  disabled={faviconBusy}
                />
                <span className="px-3 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold cursor-pointer hover:bg-orange-600 transition disabled:opacity-60">
                  {faviconBusy ? 'Reading…' : value.favicon ? 'Replace icon' : 'Upload icon'}
                </span>
              </label>
              {value.favicon && (
                <button
                  type="button"
                  onClick={() => {
                    set('favicon', '');
                    onSaved?.({ ...value, favicon: '' });
                  }}
                  className="block mt-2 text-[11px] text-gray-400 hover:text-rose-500 transition"
                >
                  Remove icon (use default)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tagline toggle + actions ── */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!value.showTagline}
            onChange={(e) => set('showTagline', e.target.checked)}
            className="w-4 h-4 rounded accent-orange-500"
          />
          <span className="text-sm text-gray-700">Show tagline under the site name</span>
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <p className="text-[11px] text-gray-400">
          {nameDirty
            ? 'Branding applies to every page, for all users, instantly.'
            : 'Using default branding.'}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting || saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            {resetting ? 'Resetting…' : 'Reset to defaults'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || resetting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold shadow-sm hover:shadow-md transition disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save branding'}
          </button>
        </div>
      </div>
    </div>
  );
};

const COLOR_SWATCHES = [
  { id: 'orange', label: 'Orange', cls: 'bg-orange-500' },
  { id: 'blue', label: 'Blue', cls: 'bg-blue-500' },
  { id: 'emerald', label: 'Emerald', cls: 'bg-emerald-500' },
  { id: 'purple', label: 'Purple', cls: 'bg-purple-500' },
  { id: 'rose', label: 'Rose', cls: 'bg-rose-500' },
];

const AppearanceForm = ({ value, onChange, onSave }) => {
  const set = (k, v) => {
    const next = { ...value, [k]: v };
    onChange(next);
    applyAppearance(next);
  };
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  const THEME_OPTIONS = [
    { id: 'light', label: 'Light', Icon: Sun },
    { id: 'dark', label: 'Dark', Icon: Moon },
    { id: 'system', label: 'System', Icon: Monitor },
  ];

  return (
    <div>
      <Field label="Theme">
        <div className="flex flex-wrap items-center gap-3">
          {THEME_OPTIONS.map(({ id, label, Icon }) => {
            const active = themeMode === id;
            return (
              <button
                key={id}
                onClick={() => setThemeMode(id)}
                type="button"
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition ${
                  active
                    ? 'border-orange-300 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] text-gray-500">
          Choose Light or Dark, or let the app follow your operating system theme.
        </p>
      </Field>

      <div className="mt-6">
      <Field label="Theme Color">
        <div className="flex flex-wrap items-center gap-3">
          {COLOR_SWATCHES.map((c) => {
            const active = value.themeColor === c.id;
            return (
              <button
                key={c.id}
                onClick={() => set('themeColor', c.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition ${
                  active
                    ? 'border-orange-300 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={`w-5 h-5 rounded-full ${c.cls}`} />
                <span className="text-sm font-semibold text-gray-700">
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </Field>
      </div>

      <div className="mt-6">
        <Field label="Layout Density">
          <div className="flex flex-wrap gap-2">
            {['comfortable', 'compact', 'spacious'].map((d) => {
              const active = value.layoutDensity === d;
              return (
                <button
                  key={d}
                  onClick={() => set('layoutDensity', d)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                    active
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <SaveBar onSave={onSave} />
    </div>
  );
};

export default SettingsPage;
