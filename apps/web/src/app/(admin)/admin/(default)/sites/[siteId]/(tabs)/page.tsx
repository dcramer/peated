"use client";

import { ExternalSiteKeySchema } from "@peated/server/schemas";
import { AdminPage } from "@peated/web/components/admin/adminContent.stylex";
import ScraperAdapterStatus from "@peated/web/components/admin/scraperAdapterStatus";
import ScraperIconSettings from "@peated/web/components/admin/scraperIconSettings";
import { ScraperParsingEditor } from "@peated/web/components/admin/scraperParsingEditor.stylex";
import { getSetupAfterLatestVersion } from "@peated/web/components/admin/scraperParsingStatus";
import ScraperPublicationSettings from "@peated/web/components/admin/scraperPublicationSettings";
import ScraperReadiness from "@peated/web/components/admin/scraperReadiness";
import ScraperScheduleSettings from "@peated/web/components/admin/scraperScheduleSettings.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { use } from "react";

export default function Page(props: { params: Promise<{ siteId: string }> }) {
  const { siteId } = use(props.params);
  const siteKey = ExternalSiteKeySchema.parse(siteId);
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { data: site } = useSuspenseQuery(
    orpc.externalSites.healthDetails.queryOptions({ input: { site: siteKey } }),
  );
  const sourceQuery = orpc.externalSites.scrapeSources.list.queryOptions({
    input: { site: siteKey },
  });
  const { data: sources } = useSuspenseQuery({
    ...sourceQuery,
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

  return (
    <AdminPage>
      <ScraperScheduleSettings key={site.runEvery ?? "manual"} site={site} />
      <ScraperIconSettings site={site} />
      {site.reviewPublication ? (
        <ScraperPublicationSettings site={site} />
      ) : null}
      <ScraperReadiness site={site} />
      {source ? (
        <ScraperParsingEditor
          key={source.revisions[0]?.id ?? "setup"}
          source={source}
          refresh={async () => {
            await queryClient.invalidateQueries({
              queryKey: sourceQuery.queryKey,
            });
          }}
        />
      ) : (
        <ScraperAdapterStatus />
      )}
    </AdminPage>
  );
}
