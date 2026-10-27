/**
 * Where PeatedBot keeps short-lived values, such as robots.txt rules. The
 * server backs it with Redis. A value may disappear at any time.
 */
export type BotCache = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
};

/**
 * One website's long-term settings. The caller stores them; PeatedBot only
 * reads them and reports changes through `onBotWall`.
 */
export type BotSiteSettings = {
  /** An admin's recorded robots.txt exception for this website. */
  robotsException: boolean;
  /** A direct request hit a bot wall, so reads go through Firecrawl. */
  blocked: boolean;
};

/** Keeps cached values in memory, for tests, evals, and local scripts. */
export function createMemoryCache(
  now: () => Date = () => new Date(),
): BotCache {
  const values = new Map<string, { value: string; expiresAt: number }>();
  return {
    get: async (key) => {
      const entry = values.get(key);
      if (!entry || entry.expiresAt <= now().getTime()) return null;
      return entry.value;
    },
    set: async (key, value, ttlMs) => {
      values.set(key, { value, expiresAt: now().getTime() + ttlMs });
    },
  };
}
