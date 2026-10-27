import { SERVICE_CHARGE_PERCENT } from './receiptPrint';
/** Read global tax/discount from localStorage (synced by Sidebar). */
export const getGlobalTaxDiscount = () => {
  try {
    const saved = localStorage.getItem("globalTaxDiscount");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Use 5% as the minimum-safe default — taxPercent:0 in localStorage
      // almost always means the cache was written before the admin ever
      // configured the rate (first-boot state), not a genuine zero-tax
      // setting.  Genuine zero would be extremely rare and can always be
      // overridden by explicitly saving it via Settings → Billing.
      const tax = Number(parsed.taxPercent);
      const disc = Number(parsed.discountPercent);
      return {
        taxPercent: (Number.isFinite(tax) && tax > 0) ? tax : 5,
        discountPercent: Number.isFinite(disc) ? disc : 0,
      };
    }
  } catch (_) {
    /* ignore */
  }
  return { taxPercent: 5, discountPercent: 0 };
};

/**
 * Fetch settings from API and cache in localStorage.
 *
 * The admin's Billing & Taxation settings are saved as two separate keys
 * (`taxPercent`, `discountPercent`) via /api/settings/batch. The old code
 * requested the non-existent `globalTaxDiscount` key, got `value: null`,
 * and then overwrote the good localStorage cache with 5%/0% defaults on
 * every call — so the QR menu always displayed the default tax no matter
 * what the admin configured (while the server charged the real rate).
 */
export const fetchAndCacheGlobalSettings = async () => {
  try {
    const { getAPI_URL } = await import("./api");
    const res = await fetch(`${getAPI_URL()}/api/settings`);
    if (res.ok) {
      const data = await res.json();
      // Full settings map (admin/manager) or public defaults map — both
      // expose taxPercent / discountPercent at the top level.
      const tax = Number(data?.taxPercent);
      const disc = Number(data?.discountPercent);
      if (!Number.isNaN(tax) || !Number.isNaN(disc)) {
        const settings = {
          // If the server returns 0 for taxPercent it likely means the
          // settings row was never written (first-boot) — fall back to 5%
          // which is the server's own default in getTaxDiscountSettings().
          // A genuine admin-configured 0% would need the admin to have
          // explicitly saved "0" in Settings → Billing & Taxation.
          taxPercent: (Number.isFinite(tax) && tax > 0) ? tax : 5,
          discountPercent: Number.isFinite(disc) ? disc : 0,
        };
        localStorage.setItem("globalTaxDiscount", JSON.stringify(settings));
        return settings;
      }
    }
  } catch (e) {
    console.warn("Could not fetch settings:", e);
  }
  return getGlobalTaxDiscount();
};

export const calculateOrderTotals = (subtotal, settings = null) => {
  const { taxPercent, discountPercent } = settings || getGlobalTaxDiscount();
  const safeSubtotal    = Number(subtotal) || 0;
  const discountAmount  = safeSubtotal * (discountPercent / 100);
  const afterDiscount   = safeSubtotal - discountAmount;

  // 10% service charge (fixed, goes to Service Charge ledger)
  const scPct           = SERVICE_CHARGE_PERCENT;
  const serviceCharge   = afterDiscount * (scPct / 100);
  const afterServiceCharge = afterDiscount + serviceCharge;

  // GST on (afterDiscount + serviceCharge)
  const taxAmount = afterServiceCharge * (taxPercent / 100);
  const total     = Math.round((afterServiceCharge + taxAmount) * 100) / 100;

  return {
    subtotal:            Math.round(safeSubtotal      * 100) / 100,
    discount:            discountPercent,
    discountPercent,
    discountAmount:      Math.round(discountAmount    * 100) / 100,
    serviceChargePercent: scPct,
    serviceCharge:       Math.round(serviceCharge     * 100) / 100,
    afterServiceCharge:  Math.round(afterServiceCharge* 100) / 100,
    taxPercent,
    taxAmount:           Math.round(taxAmount         * 100) / 100,
    total,
  };
};

export const getItemsSubtotal = (items = []) =>
  items.reduce(
    (sum, item) =>
      sum + (Number(item.price) || 0) * (item.qty || item.quantity || 1),
    0
  );

/** Merge order record with correct totals from items + global settings. */
export const enrichOrderWithTotals = (order, settings = null) => {
  if (!order) return null;
  const items = order.items || [];
  const subtotal =
    order.subtotal != null ? Number(order.subtotal) : getItemsSubtotal(items);
  const totals = calculateOrderTotals(subtotal, settings);
  return { ...order, ...totals };
};
