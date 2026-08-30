import type { Outputs } from "@peated/server/orpc/router";

type Source = Outputs["externalSites"]["scrapeSources"]["list"][number];
type Setup = Source["setup"];

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
