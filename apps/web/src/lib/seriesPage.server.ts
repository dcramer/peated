"server only";

import { permanentRedirect } from "next/navigation";
import { cache } from "react";
import { getAnonymousServerClient } from "./orpc/client.server";
import { resolveOrNotFound } from "./orpc/notFound.server";
import { getCanonicalPublicRouteRedirectPath } from "./tombstoneRedirect";
import { getBottleSeriesUrl } from "./urls";

export type SeriesPageServices<
  Series extends { id: number; fullName: string },
> = {
  loadSeries: (seriesId: number) => Promise<Series>;
  getRedirectPath: (options: {
    canonicalSeries: Series;
    currentId: number;
  }) => Promise<string | null>;
  redirect: (path: string) => never;
};

/** Loads a Series and follows its canonical tombstone and public slug. */
export function createSeriesPageLoader<
  Series extends { id: number; fullName: string },
>(services: SeriesPageServices<Series>) {
  return async function loadSeriesPage(seriesId: number) {
    const series = await services.loadSeries(seriesId);
    const redirectPath = await services.getRedirectPath({
      canonicalSeries: series,
      currentId: seriesId,
    });

    if (redirectPath) services.redirect(redirectPath);
    return series;
  };
}

const loadSeriesPage = createSeriesPageLoader({
  async loadSeries(seriesId: number) {
    const { client } = await getAnonymousServerClient();
    return await resolveOrNotFound(
      client.bottleSeries.details({ series: seriesId }),
    );
  },
  getRedirectPath: ({ canonicalSeries, currentId }) =>
    getCanonicalPublicRouteRedirectPath({
      canonicalId: canonicalSeries.id,
      canonicalPath: getBottleSeriesUrl(canonicalSeries),
      currentId,
      currentPathPrefixes: [
        `/series/${currentId}`,
        `/${canonicalSeries.peatedId}`,
      ],
    }),
  redirect: permanentRedirect,
});

export const getSeriesPage = cache(loadSeriesPage);
