import type { ReactNode } from "react";

import { getCurrentUser } from "@peated/web/lib/auth.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { serializeSeriesStructuredData } from "@peated/web/lib/catalogStructuredData";
import { getSeriesPage } from "@peated/web/lib/seriesPage.server";

import { SeriesPageFrame } from "./seriesPageFrame.stylex";

export default async function SeriesLayout(props: {
  children: ReactNode;
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await props.params;
  const [series, currentUser] = await Promise.all([
    getSeriesPage(parseCatalogRouteId(seriesId)),
    getCurrentUser(),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeSeriesStructuredData(series),
        }}
      />
      <SeriesPageFrame
        hasCurrentUser={Boolean(currentUser)}
        initialSeries={series}
      >
        {props.children}
      </SeriesPageFrame>
    </>
  );
}
