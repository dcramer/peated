"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import {
  ButtonLink,
  LoadingList,
  SectionError,
} from "@peated/web/components/designSystem/components";
import {
  HomeContributionPrompt,
  HomeDistilleries,
  HomeLatestReleases,
  HomeOrigins,
  HomeRecentBottles,
  HomeRecentReviews,
} from "@peated/web/components/designSystem/patterns/homeBrowse.stylex";
import { HomePage } from "@peated/web/components/designSystem/patterns/homePage.stylex";
import { HomeSectionLoading } from "@peated/web/components/designSystem/patterns/homeSummary.stylex";
import { PageColumns } from "@peated/web/components/designSystem/patterns/pageLayout.stylex";
import { Search } from "@peated/web/components/search/search.stylex";
import TimeSince from "@peated/web/components/timeSince";
import useAuth from "@peated/web/hooks/useAuth";
import { getBottleReviewMetadata } from "@peated/web/lib/bottleMetadata";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  memberHomeQueries,
  publicHomeQueries,
} from "@peated/web/lib/orpc/homeQueries";
import { getEntityUrl } from "@peated/web/lib/urls";
import { space } from "../../../../styles/tokens.stylex";

type Bottle = Outputs["bottles"]["list"]["results"][number];

export function PublicHome() {
  const orpc = useORPC();
  const router = useRouter();
  const { user } = useAuth();
  const stats = useQuery(publicHomeQueries.stats(orpc));
  const totalBottles = stats.data?.bottles;

  return (
    <HomePage
      content={
        <>
          <div {...stylex.props(styles.ratingsGrid)}>
            <LatestReleases />
            <RecentReviews />
          </div>
          <Origins />
          <PageColumns
            rail={
              <>
                <RecentBottles totalBottles={totalBottles} />
                <HomeContributionPrompt
                  primaryAction={
                    <ButtonLink
                      href={user ? "/addBottle?intent=catalog" : "/register"}
                      size="sm"
                      variant="accent"
                    >
                      {user ? "Add a bottle" : "Create an account"}
                    </ButtonLink>
                  }
                  secondaryAction={
                    <ButtonLink href="/bottles" size="sm" variant="text">
                      Or keep browsing
                    </ButtonLink>
                  }
                />
              </>
            }
            railBehavior="stack"
          >
            <Distilleries
              totalBottlers={stats.data?.bottlers}
              totalBrands={stats.data?.brands}
              totalDistilleries={stats.data?.distilleries}
            />
          </PageColumns>
        </>
      }
      description="Browse whisky bottlings, including single casks, with critic scores and tasting notes. No account needed."
      search={
        <Search
          onSubmit={(query) =>
            router.push(
              query ? `/search?q=${encodeURIComponent(query)}` : "/search",
            )
          }
          placeholder={
            totalBottles === undefined
              ? "Search bottlings…"
              : `Search ${totalBottles.toLocaleString("en-US")} bottlings…`
          }
          scopeValues={["all"]}
          showBottleMeasures={false}
          submitLabel="Search"
        />
      }
      title="A record of whisky, bottle by bottle."
    />
  );
}

function LatestReleases() {
  const orpc = useORPC();
  const { user } = useAuth();
  const globalReleases = useQuery(publicHomeQueries.releases(orpc));
  const followedReleases = useQuery({
    ...memberHomeQueries.followedReleases(orpc),
    enabled: Boolean(user),
  });
  const useFollowedReleases = Boolean(
    user && followedReleases.data?.results.length,
  );
  const releases = useFollowedReleases
    ? followedReleases.data
    : globalReleases.data;

  if (
    !useFollowedReleases &&
    (globalReleases.isPending || (Boolean(user) && followedReleases.isPending))
  ) {
    return (
      <HomeSectionLoading>
        <LoadingList label="Loading recent releases" rows={4} />
      </HomeSectionLoading>
    );
  }

  if (!releases) {
    return (
      <SectionError
        heading="Recent releases are unavailable"
        onRetry={() => {
          void globalReleases.refetch();
          if (user) void followedReleases.refetch();
        }}
      >
        We couldn't load the recent releases. The rest of the database is still
        available.
      </SectionError>
    );
  }

  const items = releases.results.flatMap((bottle) =>
    bottle.releaseYear === null
      ? []
      : [
          {
            href: `/bottles/${bottle.id}`,
            metadata: getReleaseMetadata(bottle),
            name: formatBottleDisplayName(bottle),
          },
        ],
  );

  return items.length ? (
    <HomeLatestReleases
      bottles={items}
      seeAllHref={
        useFollowedReleases
          ? "/bottles?filter=following&sort=-release"
          : "/bottles?sort=-release"
      }
      title={
        useFollowedReleases
          ? "New from distilleries you follow"
          : "Recent releases"
      }
    />
  ) : null;
}

function RecentReviews() {
  const orpc = useORPC();
  const externalReviews = useQuery(publicHomeQueries.recentReviews(orpc));

  if (externalReviews.isPending) {
    return (
      <HomeSectionLoading>
        <LoadingList label="Loading recent critic reviews" rows={4} />
      </HomeSectionLoading>
    );
  }

  if (externalReviews.error) {
    return (
      <SectionError
        heading="Critic reviews are unavailable"
        onRetry={() => void externalReviews.refetch()}
      >
        We couldn't load the latest critic reviews. The rest of the database is
        still available.
      </SectionError>
    );
  }

  const items = externalReviews.data.results.flatMap((review) =>
    review.bottle
      ? [
          {
            bottleHref: `/bottles/${review.bottle.id}`,
            bottleName: formatBottleDisplayName(review.bottle),
            date: (
              <TimeSince
                date={review.article.publishedAt ?? review.createdAt}
              />
            ),
            id: String(review.id),
            metadata: getBottleReviewMetadata(review.bottle),
            rating:
              review.nativeScore?.scale === 100
                ? review.nativeScore.value
                : null,
            source: review.site?.name ?? review.reviewerName ?? "Critic review",
            sourceHref: review.url,
          },
        ]
      : [],
  );

  return items.length ? <HomeRecentReviews reviews={items} /> : null;
}

function Origins() {
  const orpc = useORPC();
  const countries = useQuery(publicHomeQueries.countries(orpc));
  const regions = useQuery(publicHomeQueries.regions(orpc));

  if (countries.isPending || regions.isPending) {
    return (
      <HomeSectionLoading>
        <LoadingList label="Loading whisky origins" rows={3} />
      </HomeSectionLoading>
    );
  }

  if (countries.error && regions.error) {
    return (
      <SectionError
        heading="Origins are unavailable"
        onRetry={() => {
          void countries.refetch();
          void regions.refetch();
        }}
      >
        We couldn't load the origin guide. Bottle search and the other homepage
        sections still work.
      </SectionError>
    );
  }

  const countryItems = countries.data?.results ?? [];
  const regionItems = regions.data?.results ?? [];
  const featuredCountries = countryItems.slice(0, 3);
  const remainingCountries = countryItems.slice(3);

  return countryItems.length || regionItems.length ? (
    <HomeOrigins
      countries={featuredCountries.map((country) => ({
        description: country.summary ?? undefined,
        href: `/locations/${country.slug}`,
        name: country.name,
        slug: country.slug,
        totalBottles: country.totalBottles,
      }))}
      regions={regionItems.slice(0, 4).map((region) => ({
        description: region.description ?? undefined,
        href: `/locations/${region.country.slug}/regions/${region.slug}`,
        name: region.name,
        slug: region.slug,
        totalBottles: region.totalBottles,
      }))}
      remainingCountries={
        remainingCountries.length
          ? {
              count: remainingCountries.length,
              totalBottles: remainingCountries.reduce(
                (total, country) => total + country.totalBottles,
                0,
              ),
            }
          : undefined
      }
    />
  ) : null;
}

function Distilleries({
  totalBottlers,
  totalBrands,
  totalDistilleries,
}: {
  totalBottlers?: number;
  totalBrands?: number;
  totalDistilleries?: number;
}) {
  const orpc = useORPC();
  const distilleries = useQuery(publicHomeQueries.distilleries(orpc));

  if (distilleries.isPending) {
    return (
      <HomeSectionLoading>
        <LoadingList label="Loading distilleries" rows={3} />
      </HomeSectionLoading>
    );
  }

  if (distilleries.error) {
    return (
      <SectionError
        heading="Distilleries are unavailable"
        onRetry={() => void distilleries.refetch()}
      >
        We couldn't load the distilleries with the most bottlings. The other
        homepage sections still work.
      </SectionError>
    );
  }

  return distilleries.data.results.length ? (
    <HomeDistilleries
      distilleries={distilleries.data.results.map((distillery) => ({
        href: getEntityUrl(distillery),
        location: [distillery.region?.name, distillery.country?.name]
          .filter(Boolean)
          .join(", "),
        name: distillery.name,
        totalBottles: distillery.totalBottles,
      }))}
      links={[
        {
          href: "/distillers",
          label:
            totalDistilleries === undefined
              ? "All distilleries"
              : `All ${totalDistilleries.toLocaleString("en-US")} distilleries`,
        },
        {
          href: "/brands",
          label:
            totalBrands === undefined
              ? "Brands"
              : `${totalBrands.toLocaleString("en-US")} brands`,
        },
        {
          href: "/bottlers",
          label:
            totalBottlers === undefined
              ? "Independent bottlers"
              : `${totalBottlers.toLocaleString("en-US")} bottlers`,
        },
        { href: "/locations", label: "Map" },
      ]}
    />
  ) : null;
}

function RecentBottles({ totalBottles }: { totalBottles?: number }) {
  const orpc = useORPC();
  const bottles = useQuery(publicHomeQueries.recentBottles(orpc));

  if (bottles.isPending) {
    return (
      <HomeSectionLoading>
        <LoadingList label="Loading recently added bottles" rows={3} />
      </HomeSectionLoading>
    );
  }

  if (bottles.error) {
    return (
      <SectionError
        heading="Recent bottles are unavailable"
        onRetry={() => void bottles.refetch()}
      >
        We couldn't load the latest records. Browse all bottles instead.
      </SectionError>
    );
  }

  return bottles.data.results.length ? (
    <HomeRecentBottles
      bottles={bottles.data.results.map((bottle) => ({
        href: `/bottles/${bottle.id}`,
        metadata: getBottleMetadata(bottle),
        name: formatBottleDisplayName(bottle),
      }))}
      totalBottles={totalBottles}
    />
  ) : null;
}

function getBottleMetadata(bottle: Bottle) {
  return [
    bottle.caskNumber ? `Cask ${bottle.caskNumber}` : null,
    bottle.statedAge === null ? null : `${bottle.statedAge} years`,
    bottle.abv === null ? null : `${bottle.abv.toFixed(1)}% ABV`,
  ].filter((value): value is string => Boolean(value));
}

function getReleaseMetadata(bottle: Bottle) {
  const distiller = bottle.distillers[0]?.name ?? bottle.brand.name;

  return [
    distiller,
    bottle.releaseYear === null ? null : `${bottle.releaseYear} release`,
    bottle.statedAge === null ? null : `${bottle.statedAge} yr`,
    bottle.abv === null ? null : `${bottle.abv.toFixed(1)}%`,
  ].filter((value): value is string => Boolean(value));
}

const STACKED = "@media (max-width: 759px)";

const styles = stylex.create({
  ratingsGrid: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: space.x8,
    [STACKED]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
});
