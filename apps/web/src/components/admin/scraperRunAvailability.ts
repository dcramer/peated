import type { Outputs } from "@peated/server/orpc/router";

type Site = Outputs["externalSites"]["healthDetails"];

type ScraperRunAvailability = {
  label: string;
  reason: string;
};

export function getScraperRunAvailability(
  site: Site,
): ScraperRunAvailability | null {
  if (!site.runtime.registered) {
    return {
      label: "Run unavailable",
      reason: "This scraper is not registered with the runtime.",
    };
  }

  const missingTarget = site.runtime.targetKeys.find(
    (key) => !site.runtime.targets.some((target) => target.key === key),
  );
  if (missingTarget) {
    return {
      label: "Run unavailable",
      reason: `Scraper target ${missingTarget} is not synchronized.`,
    };
  }

  const disabledTarget = site.runtime.targets.find(
    (target) => site.runtime.targetKeys.includes(target.key) && !target.enabled,
  );
  if (disabledTarget) {
    return {
      label: "Scraper disabled",
      reason: `Scraper target ${disabledTarget.key} is disabled.`,
    };
  }

  if (site.reviewPolicy?.allowFetching === false) {
    return {
      label: "Run unavailable",
      reason: "Fetching is blocked by review policy.",
    };
  }

  return null;
}
