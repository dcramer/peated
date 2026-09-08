"server only";

import {
  isORPCClientError,
  isORPCNotFoundError,
} from "@peated/orpc/client/errors";
import { logInfo } from "@peated/web/lib/log";
import { notFound } from "next/navigation";

type CountrySource = "path" | "query";

interface CountryNotFoundDependencies {
  logInfo: typeof logInfo;
  notFound: typeof notFound;
}

export async function resolveOrNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (isORPCNotFoundError(error)) {
      notFound();
    }

    throw error;
  }
}

export function createCountryNotFoundResolver({
  logInfo: writeLog,
  notFound: renderNotFound,
}: CountryNotFoundDependencies) {
  /** Turn an expected invalid country request into a logged public 404. */
  return async function resolveCountryOrNotFound<T>(
    promise: Promise<T>,
    source: CountrySource,
  ): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      const invalidCountry =
        isORPCClientError(error) &&
        error.status === 400 &&
        error.message === "Invalid country.";

      if (isORPCNotFoundError(error) || invalidCountry) {
        writeLog("Country did not match the catalog", {
          extra: { "peated.catalog.country.source": source },
        });
        renderNotFound();
      }

      throw error;
    }
  };
}

export const resolveCountryOrNotFound = createCountryNotFoundResolver({
  logInfo,
  notFound,
});
