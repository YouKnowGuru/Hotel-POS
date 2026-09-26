import { useMemo } from "react";
import {
  convertFromINR,
  formatCurrency,
  BHUTAN_CURRENCY,
} from "../utils/currency";

export function useCurrency(locationSettings) {
  return useMemo(() => {
    return {
      country: "Bhutan",
      symbol: BHUTAN_CURRENCY.currencySymbol,
      code: BHUTAN_CURRENCY.currencyCode,
      taxRate: locationSettings?.taxRate ?? BHUTAN_CURRENCY.taxRate,
      /** Display formatted price in Bhutanese Ngultrum (Nu.) */
      format: (amount) => formatCurrency(amount, locationSettings),
      /** Numeric value in Bhutanese Ngultrum */
      convert: (amount) => convertFromINR(amount),
    };
  }, [
    locationSettings?.taxRate,
    locationSettings?.currencySymbol,
  ]);
}

export default useCurrency;
