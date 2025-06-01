import type { Currency } from "@peated/server/types";

export default function Price({
  value,
  currency,
  noCents = false,
}: {
  value: number;
  currency: Currency;
  noCents?: boolean;
}) {
  return <>{formatPrice(value, currency, noCents)}</>;
}

function formatPrice(value: number, currency: Currency, noCents: boolean) {
  const fValue = noCents ? Math.round(value / 100) : (value / 100).toFixed(2);
  switch (currency) {
    case "usd":
      return `$${fValue}`;
    case "gbp":
      return `£${fValue}`;
    case "eur":
      return `€${fValue}`;
    default:
      throw new Error(`Invalid currency: ${currency}`);
  }
}
