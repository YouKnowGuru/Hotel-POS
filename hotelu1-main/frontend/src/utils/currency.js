/**
 * Currency configuration for Restaurant POS.
 * All prices and calculations strictly use Bhutanese Ngultrum (Nu. / BTN).
 */

export const BASE_CURRENCY = "BTN";

export const BHUTAN_CURRENCY = {
  country: "Bhutan",
  currencySymbol: "Nu. ",
  currencyCode: "BTN",
  rateFromINR: 1,
  taxRate: 0.05,
};

export const COUNTRY_CURRENCY = {
  Bhutan: BHUTAN_CURRENCY,
};

export function getLocationSettingsForCountry() {
  return { ...BHUTAN_CURRENCY };
}

/** Format and convert amounts to Bhutanese currency */
export function convertFromINR(amount) {
  return Number(amount) || 0;
}

export function formatCurrency(amount, locationSettings) {
  const symbol = locationSettings?.currencySymbol || BHUTAN_CURRENCY.currencySymbol;
  const value = Number(amount) || 0;
  return `${symbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
