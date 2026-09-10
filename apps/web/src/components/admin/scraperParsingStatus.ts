import type { Outputs } from "@peated/server/orpc/router";
import { SCRAPE_RULES_VERSION } from "@peated/server/schemas";

type Source = Outputs["externalSites"]["scrapeSources"]["list"][number];
type Setup = Source["setup"];
type SetupSource = Pick<Source, "setup" | "enabled" | "activeRevisionId"> & {
  revisions: Pick<
    Source["revisions"][number],
    "id" | "createdAt" | "previewStatus" | "rulesVersion"
  >[];
};

export function getSetupAfterLatestVersion(source: {
  setup: Setup;
  revisions: { createdAt: string }[];
}): Setup {
  const { setup } = source;
  if (!setup) return null;

  const latest = source.revisions[0];
  if (!latest) return setup;

  return Date.parse(setup.createdAt) > Date.parse(latest.createdAt)
    ? setup
    : null;
}

export function needsScrapeRulesUpdate(source: {
  revisions: { rulesVersion: number }[];
}) {
  const latest = source.revisions[0];
  return Boolean(latest && latest.rulesVersion < SCRAPE_RULES_VERSION);
}

export function getSetupSteps(source: SetupSource) {
  const latest = source.revisions[0];
  const setupStatus = getSetupAfterLatestVersion(source)?.status;
  const setupComplete =
    latest?.previewStatus === "passed" &&
    (!setupStatus || setupStatus === "succeeded");
  const active = source.revisions.find(
    (revision) => revision.id === source.activeRevisionId,
  );
  const collecting = source.enabled && active?.previewStatus === "passed";

  return [
    {
      name: "Build and test",
      status:
        setupStatus === "running"
          ? "Running"
          : setupStatus === "queued"
            ? "Queued"
            : setupStatus === "failed" || latest?.previewStatus === "failed"
              ? "Needs attention"
              : latest
                ? setupComplete
                  ? "Complete"
                  : "Needs test"
                : "Not started",
      tone: setupComplete
        ? ("success" as const)
        : setupStatus === "failed" || latest?.previewStatus === "failed"
          ? ("danger" as const)
          : ("neutral" as const),
    },
    {
      name: "Collection",
      status: collecting
        ? "Active"
        : source.enabled && source.activeRevisionId
          ? "Stopped"
          : source.activeRevisionId
            ? "Paused"
            : "Waiting",
      tone: collecting ? ("success" as const) : ("neutral" as const),
    },
  ];
}

export function getSetupDescription(source: SetupSource) {
  const hasRevision = source.revisions.length > 0;
  const setup = getSetupAfterLatestVersion(source);

  if (setup?.status === "running") {
    return hasRevision
      ? "Peated is updating this site's setup."
      : "Peated is finding the pages and information to collect.";
  }
  if (setup?.status === "queued") {
    return "Setup will start shortly. This page refreshes automatically.";
  }
  if (setup?.status === "failed") {
    return "AI could not finish setup. Review the reason, then retry when the site is available.";
  }
  if (setup?.status === "succeeded") {
    return hasRevision
      ? "The tested version is ready to activate."
      : "The tested version is loading.";
  }
  const latest = source.revisions[0];
  if (needsScrapeRulesUpdate(source)) {
    return "This source uses an older rule format. Create and test an updated version before activating it.";
  }
  if (latest?.previewStatus === "failed") {
    return "The latest version needs repair.";
  }
  if (latest?.previewStatus === "passed") {
    return source.enabled
      ? "Setup is complete."
      : "The tested version is ready to activate.";
  }
  if (latest) return "Test the saved rules before activating them.";
  return "Start AI setup to create the first version.";
}
