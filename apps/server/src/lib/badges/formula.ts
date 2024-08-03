import type { BadgeFormula } from "@peated/server/types";

export function getFormula(
  type: BadgeFormula,
): (totalXp: number, maxLevel: number) => number | null {
  switch (type) {
    case "default":
      return defaultFormula;
    case "linear":
      return linearFormula;
    case "fibonacci":
      return fibonacciFormula;
    default:
      throw new Error(`Invalid type: ${type}`);
  }
}

// TODO: use math here so perf is better
/**
 * Quadratic formula with increasing difficulty for future levels.
 */
export function defaultFormula(
  totalXp: number,
  maxLevel: number,
): number | null {
  const a = 0.02;
  const b = 0.5;
  const c = 4;

  let level = 0;
  let requiredXp = 0;
  while (requiredXp <= totalXp && level < maxLevel + 1) {
    level++;
    requiredXp += a * Math.pow(level, 2) + b * level + c;
  }

  return level - 1;
}

/**
 * Linear formula with fixed difficulty for each level.
 */
export function linearFormula(
  totalXp: number,
  maxLevel: number,
): number | null {
  const xpPerLevel = 5;
  return Math.min(Math.floor(totalXp / xpPerLevel), maxLevel);
}

/**
 * Fibonacci formula particularly useful if you want only a few levels
 * or if you're a masochist.
 */
export function fibonacciFormula(
  totalXp: number,
  maxLevel: number,
): number | null {
  let level = 0;
  let requiredXp = 0;
  let seq = [0, 1];
  while (requiredXp <= totalXp && level < maxLevel + 1) {
    level++;
    requiredXp += seq[1];
    seq = [seq[1], seq[1] + seq[0]];
  }

  return level - 1;
}
