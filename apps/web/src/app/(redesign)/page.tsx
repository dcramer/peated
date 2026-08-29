import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { getPublicStats } from "@peated/web/lib/publicStats.server";
import { getSession } from "@peated/web/lib/session.server";

import { HomePageClient } from "./homePageClient";

export default async function Page() {
  const session = await getSession();

  if (session.user) {
    return <HomePageClient />;
  }

  const { client } = await getAnonymousServerClient();
  const [
    stats,
    reviews,
    regions,
    countries,
    distilleries,
    bottles,
    highestRated,
  ] = await Promise.allSettled([
    getPublicStats(),
    client.externalReviews.list({ limit: 5, sort: "recent" }),
    client.regions.list({
      country: "scotland",
      hasBottles: true,
      limit: 6,
      sort: "-bottles",
    }),
    client.countries.list({
      hasBottles: true,
      limit: 100,
      sort: "-bottles",
    }),
    client.distilleries.list({ limit: 12, sort: "-bottles" }),
    client.bottles.list({ limit: 3, sort: "-created" }),
    client.bottles.list({ limit: 5, minScore: 0, sort: "-score" }),
  ]);

  return (
    <HomePageClient
      publicHomeInitialData={{
        bottles: bottles.status === "fulfilled" ? bottles.value : undefined,
        countries:
          countries.status === "fulfilled" ? countries.value : undefined,
        distilleries:
          distilleries.status === "fulfilled" ? distilleries.value : undefined,
        highestRated:
          highestRated.status === "fulfilled" ? highestRated.value : undefined,
        regions: regions.status === "fulfilled" ? regions.value : undefined,
        reviews: reviews.status === "fulfilled" ? reviews.value : undefined,
        stats: stats.status === "fulfilled" ? stats.value : undefined,
      }}
    />
  );
}
