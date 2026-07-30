export const GTIN_LENGTHS = [8, 12, 13, 14] as const;

export type NormalizedGtin = {
  value: string;
  gtin14: string;
};

export class InvalidGtinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGtinError";
  }
}

function expectedCheckDigit(valueWithoutCheckDigit: string): number {
  let sum = 0;
  for (
    let index = valueWithoutCheckDigit.length - 1, position = 0;
    index >= 0;
    index -= 1, position += 1
  ) {
    sum += Number(valueWithoutCheckDigit[index]) * (position % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function normalizeGtin(input: string): NormalizedGtin {
  const value = input.replace(/[\s-]/g, "");

  if (!/^\d+$/.test(value)) {
    throw new InvalidGtinError(
      "Barcode must contain only digits, spaces, or hyphens.",
    );
  }
  if (!GTIN_LENGTHS.includes(value.length as (typeof GTIN_LENGTHS)[number])) {
    throw new InvalidGtinError(
      "Barcode must be a GTIN-8, GTIN-12, GTIN-13, or GTIN-14.",
    );
  }

  const checkDigit = Number(value.at(-1));
  if (expectedCheckDigit(value.slice(0, -1)) !== checkDigit) {
    throw new InvalidGtinError("Barcode has an invalid check digit.");
  }

  return {
    value,
    gtin14: value.padStart(14, "0"),
  };
}
