import { normalizeString } from "@peated/bottle-classifier/normalize";

export function normalizeComparableText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return normalizeString(value).toLowerCase().replace(/_/g, " ").trim();
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function containsComparablePhrase(haystack: string, needle: string) {
  if (!haystack || !needle) {
    return false;
  }

  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(needle)}($|[^a-z0-9])`,
  );

  return pattern.test(haystack);
}

export function textsOverlap(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return (
    normalizedLeft === normalizedRight ||
    containsComparablePhrase(normalizedLeft, normalizedRight) ||
    containsComparablePhrase(normalizedRight, normalizedLeft)
  );
}

export function listMatchesExpectedValue(
  actualValues: string[],
  expectedValues: string[],
) {
  if (!actualValues.length || !expectedValues.length) {
    return false;
  }

  return expectedValues.every((expectedValue) =>
    actualValues.some((actualValue) =>
      textsOverlap(actualValue, expectedValue),
    ),
  );
}
