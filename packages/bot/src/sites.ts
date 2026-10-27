import type { RobotsRules } from "./robots";

/** What PeatedBot remembers about one website, keyed by its origin. */
export type BotSite = {
  /** An admin's recorded robots.txt exception for this website. */
  robotsException: boolean;
  /** The website's cached robots.txt rules, or null before the first check. */
  robots: { rules: RobotsRules; expiresAt: Date } | null;
  /** When a direct request last hit a bot wall. Null means read directly. */
  blockedAt: Date | null;
};

/** Where PeatedBot keeps website settings between reads. */
export type BotSiteStore = {
  get(origin: string): Promise<BotSite | null>;
  saveRobots(
    origin: string,
    rules: RobotsRules,
    expiresAt: Date,
  ): Promise<void>;
  markBlocked(origin: string, blockedAt: Date): Promise<void>;
};

/** A website PeatedBot has not seen yet. */
export const NEW_BOT_SITE: BotSite = {
  robotsException: false,
  robots: null,
  blockedAt: null,
};

/** Keeps website settings in memory, for tests, evals, and local scripts. */
export function createMemorySiteStore(
  initial: Record<string, Partial<BotSite>> = {},
): BotSiteStore {
  const sites = new Map<string, BotSite>(
    Object.entries(initial).map(([origin, site]) => [
      origin,
      { ...NEW_BOT_SITE, ...site },
    ]),
  );
  const update = (origin: string, change: Partial<BotSite>) => {
    sites.set(origin, { ...NEW_BOT_SITE, ...sites.get(origin), ...change });
  };
  return {
    get: async (origin) => sites.get(origin) ?? null,
    saveRobots: async (origin, rules, expiresAt) => {
      update(origin, { robots: { rules, expiresAt } });
    },
    markBlocked: async (origin, blockedAt) => {
      update(origin, { blockedAt });
    },
  };
}
