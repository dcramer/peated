import { AsyncLocalStorage } from "node:async_hooks";
import { ScraperHttpStatusError } from "./http";
import type { ScraperRequest, ScraperResponse } from "./types";

type LegacyRequestSession = {
  request(input: ScraperRequest): Promise<ScraperResponse>;
};

const legacyRequestStorage = new AsyncLocalStorage<{
  session: LegacyRequestSession;
  targetKey: string;
}>();

export async function runLegacyRequestContext<T>({
  session,
  targetKey,
  run,
}: {
  session: LegacyRequestSession;
  targetKey: string;
  run: () => Promise<T>;
}) {
  return await legacyRequestStorage.run({ session, targetKey }, run);
}

export async function requestLegacyUrl(
  url: string,
  options: Omit<ScraperRequest, "target" | "url">,
) {
  const context = legacyRequestStorage.getStore();
  if (!context) return null;
  try {
    const response = await context.session.request({
      target: context.targetKey,
      url: new URL(url),
      ...options,
    });
    return response.body;
  } catch (error) {
    if (error instanceof ScraperHttpStatusError && error.status === 404) {
      const notFound = new Error(url);
      notFound.name = "PageNotFound";
      throw notFound;
    }
    throw error;
  }
}
