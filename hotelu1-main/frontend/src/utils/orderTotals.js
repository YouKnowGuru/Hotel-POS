/** Read global tax/discount from localStorage (synced by Sidebar). */
export const getGlobalTaxDiscount = () => {
  try {
    const saved = localStorage.getItem("globalTaxDiscount");
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        taxPercent: Number(parsed.taxPercent) || 0,
        discountPercent: Number(parsed.discountPercent) || 0,
      };
    }
  } catch (_) {
    /* ignore */
  }
  return { taxPercent: 5, discountPercent: 0 };
};

/** Fetch settings from API and cache in localStorage. */
export const fetchAndCacheGlobalSettings = async () => {
  try {
    const { getAPI_URL } = await import("./api");
    const res = await fetch(`${getAPI_URL()}/api/settings?key=globalTaxDiscount`);
    if (res.ok) {
      const data = await res.json();
      const val = data.value || {};
      const tax = Number(val.taxPercent);
      const disc = Number(val.discountPercent);
      const settings = {
        taxPercent: isNaN(tax) ? 5 : tax,
        discountPercent: isNaN(disc) ? 0 : disc,
      };
      localStorage.setItem("globalTaxDiscount", JSON.stringify(settings));
      return settings;
    }
  } catch (e) {
    console.warn("Could not fetch settings:", e);
  }
  return getGlobalTaxDiscount();
};

export const calculateOrderTotals = (subtotal, settings = null) => {
  const { taxPercent, discountPercent } = settings || getGlobalTaxDiscount();
  const safeSubtotal = Number(subtotal) || 0;
  const discountAmount = safeSubtotal * (discountPercent / 100);
  const afterDiscount = safeSubtotal - discountAmount;
  const taxAmount = afterDiscount * (taxPercent / 100);
  const total = Math.round((afterDiscount + taxAmount) * 100) / 100;

  return {
    subtotal: Math.round(safeSubtotal * 100) / 100,
    discount: discountPercent,
    discountPercent,
    discountAmount: Math.round(discountAmount * 100) / 100,
    taxPercent,
    taxAmount: Math.round(taxAmount * 100) / 100,
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
