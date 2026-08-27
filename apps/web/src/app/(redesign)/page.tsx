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
  const [stats, reviews, regions, distilleries, bottles] =
    await Promise.allSettled([
      getPublicStats(),
      client.reviews.list({ limit: 5, sort: "recent" }),
      client.regions.list({
        country: "scotland",
        hasBottles: true,
        limit: 6,
        sort: "-bottles",
      }),
      client.distilleries.list({ limit: 12, sort: "-bottles" }),
      client.bottles.list({ limit: 3, sort: "-created" }),
    ]);

  return (
    <HomePageClient
      publicHomeInitialData={{
        bottles: bottles.status === "fulfilled" ? bottles.value : undefined,
        distilleries:
          distilleries.status === "fulfilled" ? distilleries.value : undefined,
        regions: regions.status === "fulfilled" ? regions.value : undefined,
        reviews: reviews.status === "fulfilled" ? reviews.value : undefined,
        stats: stats.status === "fulfilled" ? stats.value : undefined,
      }}
    />
  );
}
