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
      reason: "This source is not ready.",
    };
  }

  const missingTarget = site.runtime.targetKeys.find(
    (key) => !site.runtime.targets.some((target) => target.key === key),
  );
  if (missingTarget) {
    return {
      label: "Run unavailable",
      reason: `Request settings for ${missingTarget} are incomplete.`,
    };
  }

  const disabledTarget = site.runtime.targets.find(
    (target) => site.runtime.targetKeys.includes(target.key) && !target.enabled,
  );
  if (disabledTarget) {
    return {
      label: "Source paused",
      reason: `Requests to ${disabledTarget.key} are paused.`,
    };
  }

  return null;
}
