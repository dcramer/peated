export const PEATED_ID_PREFIXES = {
  bottle: "B",
  entity: "E",
} as const;

export type PeatedIdType = keyof typeof PEATED_ID_PREFIXES;

export type ParsedPeatedId = {
  type: PeatedIdType;
  id: number;
  peatedId: string;
};

const PEATED_ID_PATTERN = /^([BE])(\d+)$/i;
const MINIMUM_DIGITS = 4;

export function formatPeatedId(type: PeatedIdType, id: number): string {
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new RangeError("Peated IDs require a positive safe integer.");
  }

  return `${PEATED_ID_PREFIXES[type]}${String(id).padStart(MINIMUM_DIGITS, "0")}`;
}

export function parsePeatedId(value: string): ParsedPeatedId | null {
  const match = PEATED_ID_PATTERN.exec(value.trim());
  if (!match) return null;

  const type = match[1].toUpperCase() === "B" ? "bottle" : "entity";
  const id = Number(match[2]);
  if (!Number.isSafeInteger(id) || id < 1) return null;

  return {
    type,
    id,
    peatedId: formatPeatedId(type, id),
  };
}

export function isCanonicalPeatedId(
  value: string,
  type: PeatedIdType,
): boolean {
  const parsed = parsePeatedId(value);
  return parsed?.type === type && parsed.peatedId === value;
}
