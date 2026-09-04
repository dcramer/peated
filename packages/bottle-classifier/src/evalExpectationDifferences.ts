import type { JsonValue } from "vitest-evals/harness";
import { z } from "zod";

export type JsonSubsetDifference = {
  path: string;
  expected: JsonValue;
  actual: JsonValue | undefined;
};

function parseJsonRecord(
  value: JsonValue | undefined,
): Record<string, JsonValue> | null {
  const result = z.record(z.string(), z.json()).safeParse(value);
  return result.success ? result.data : null;
}

function childPath(path: string, key: string) {
  return path ? `${path}.${key}` : key;
}

export function findJsonSubsetDifferences(
  actual: JsonValue | undefined,
  expected: JsonValue,
  path = "",
): JsonSubsetDifference[] {
  if (Array.isArray(expected)) {
    if (actual === undefined) {
      return expected.length === 0
        ? [{ path, expected, actual }]
        : expected.flatMap((value, index) =>
            findJsonSubsetDifferences(undefined, value, `${path}[${index}]`),
          );
    }

    if (!Array.isArray(actual)) {
      return [{ path, expected, actual }];
    }

    return expected.flatMap((value, index) =>
      findJsonSubsetDifferences(actual[index], value, `${path}[${index}]`),
    );
  }

  const expectedRecord = parseJsonRecord(expected);
  if (expectedRecord) {
    if (actual === undefined) {
      const entries = Object.entries(expectedRecord);
      return entries.length === 0
        ? [{ path, expected, actual }]
        : entries.flatMap(([key, value]) =>
            findJsonSubsetDifferences(undefined, value, childPath(path, key)),
          );
    }

    const actualRecord = parseJsonRecord(actual);
    if (!actualRecord) {
      return [{ path, expected, actual }];
    }

    return Object.entries(expectedRecord).flatMap(([key, value]) =>
      findJsonSubsetDifferences(actualRecord[key], value, childPath(path, key)),
    );
  }

  return Object.is(actual, expected) ? [] : [{ path, expected, actual }];
}

function formatJsonValue(value: JsonValue) {
  const text = JSON.stringify(value);
  return text.length <= 160 ? text : `${text.slice(0, 157)}...`;
}

export function formatJsonSubsetDifference(difference: JsonSubsetDifference) {
  const expected = formatJsonValue(difference.expected);
  return difference.actual === undefined
    ? `${difference.path} expected ${expected} but was missing`
    : `${difference.path} expected ${expected} but got ${formatJsonValue(difference.actual)}`;
}
