"use client";

import { ExternalSiteKeySchema } from "@peated/server/schemas";
import { ScraperParsingEditor } from "@peated/web/components/admin/scraperParsingEditor.stylex";
import { getSetupAfterLatestVersion } from "@peated/web/components/admin/scraperParsingStatus";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { use } from "react";

export default function Page(props: { params: Promise<{ siteId: string }> }) {
  const { siteId } = use(props.params);
  const site = ExternalSiteKeySchema.parse(siteId);
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const query = orpc.externalSites.scrapeSources.list.queryOptions({
    input: { site },
  });
  const { data: sources } = useSuspenseQuery({
    ...query,
    refetchInterval: ({ state }) => {
      const current = state.data?.[0];
      if (!current) return false;
      const setup = getSetupAfterLatestVersion(current);
      if (!current.revisions.length) {
        return setup?.status === "failed" ? false : 2_000;
      }
      return setup?.status === "queued" || setup?.status === "running"
        ? 2_000
        : false;
    },
  });
  const source = sources[0];
  if (!source) throw new Error("Site setup not found.");

  return (
    <ScraperParsingEditor
      key={source.revisions[0]?.id ?? "setup"}
      source={source}
      refresh={async () => {
        await queryClient.invalidateQueries({ queryKey: query.queryKey });
      }}
    />
  );
}
