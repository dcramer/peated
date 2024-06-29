import { type Currency } from "@peated/server/types";

export default function Price({
  value,
  currency,
}: {
  value: number;
  currency: Currency;
}) {
  return <>{formatPrice(value, currency)}</>;
}

function formatPrice(value: number, currency: Currency) {
  switch (currency) {
    case "usd":
      return `$${(value / 100).toFixed(2)}`;
    case "gbp":
      return `£${(value / 100).toFixed(2)}`;
    case "eur":
      return `€${(value / 100).toFixed(2)}`;
    default:
      throw new Error(`Invalid currency: ${currency}`);
  }
}
