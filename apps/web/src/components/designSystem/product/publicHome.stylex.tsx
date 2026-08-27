"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { useORPC } from "../../../lib/orpc/context";
import { getEntityUrl } from "../../../lib/urls";
import TimeSince from "../../timeSince";
import { ButtonLink, LoadingList, SectionError } from "../components";
import {
  HomeContributionPrompt,
  HomeDistilleries,
  HomeQuestions,
  HomeRecentBottles,
  HomeRecentReviews,
  HomeRegions,
} from "../patterns/homeBrowse.stylex";
import { HomePage } from "../patterns/homePage.stylex";
import { HomeSectionLoading } from "../patterns/homeSummary.stylex";
import { PageColumns } from "../patterns/pagePatternShell.stylex";
import { Search } from "./search.stylex";

type Bottle = Outputs["bottles"]["list"]["results"][number];

export type PublicHomeInitialData = {
  bottles?: Outputs["bottles"]["list"];
  distilleries?: Outputs["distilleries"]["list"];
  regions?: Outputs["regions"]["list"];
  reviews?: Outputs["reviews"]["list"];
  stats?: Outputs["stats"];
};

const questions = [
  {
    question: "How is a Community Score calculated?",
    answer:
      "Peated averages the point ratings for that exact bottling. Pass, Sip, and Savor ratings stay separate.",
  },
  {
    question: "Why do some bottles have no Community Score?",
    answer:
      "A bottle has no Community Score until someone gives it a point rating. Pass, Sip, and Savor ratings stay separate.",
  },
  {
    question: "Do I need an account?",
    answer:
      "You only need an account to record a tasting, keep a library, or add a bottling. Every public record is free to browse.",
  },
  {
    question: "Where do critic reviews come from?",
    answer:
      "Each review keeps its source and original scale. Peated never turns 7/10 into 70/100.",
  },
] as const;

export function PublicHome({
  initialData,
}: {
  initialData?: PublicHomeInitialData;
}) {
  const orpc = useORPC();
  const router = useRouter();
  const stats = useQuery({
    ...orpc.stats.queryOptions(),
    initialData: initialData?.stats,
  });
  const totalBottles = stats.data?.totalBottles;
  const totalTastings = stats.data?.totalTastings;

  return (
    <HomePage
      content={
        <>
          <RecentReviews initialData={initialData?.reviews} />
          <Regions initialData={initialData?.regions} />
          <PageColumns
            rail={
              <>
                <RecentBottles
                  initialData={initialData?.bottles}
                  totalBottles={totalBottles}
                />
                <HomeContributionPrompt
                  primaryAction={
                    <ButtonLink href="/register" size="sm" variant="accent">
                      Create an account
                    </ButtonLink>
                  }
                  secondaryAction={
                    <ButtonLink href="/bottles" size="sm" variant="text">
                      Keep browsing
                    </ButtonLink>
                  }
                />
              </>
            }
            railBehavior="stack"
          >
            <Distilleries
              initialData={initialData?.distilleries}
              totalBlenders={stats.data?.totalBlenders}
              totalBottlers={stats.data?.totalBottlers}
              totalBrands={stats.data?.totalBrands}
              totalDistilleries={stats.data?.totalDistilleries}
            />
          </PageColumns>
          <HomeQuestions questions={questions} />
        </>
      }
      description={
        totalTastings === undefined
          ? "Browse bottlings down to the cask, published critic scores on their original scales, and tasting notes from the people who drank them. No account needed."
          : `Browse bottlings down to the cask, published critic scores on their original scales, and ${totalTastings.toLocaleString("en-US")} recorded tastings. No account needed.`
      }
      search={
        <Search
          onSubmit={(query) =>
            router.push(
              query ? `/search?q=${encodeURIComponent(query)}` : "/search",
            )
          }
          scopeValues={["all"]}
          showBottleMeasures={false}
          submitLabel="Search"
        />
      }
      signedIn={false}
      title={
        totalBottles === undefined
          ? "Whisky bottlings, critic scores, and tasting notes."
          : `Whisky bottlings, critic scores, and tasting notes — ${totalBottles.toLocaleString("en-US")} records.`
      }
    />
  );
}

function RecentReviews({
  initialData,
}: {
  initialData?: Outputs["reviews"]["list"];
}) {
  const orpc = useORPC();
  const reviews = useQuery({
    ...orpc.reviews.list.queryOptions({
      input: { limit: 5, sort: "recent" },
    }),
    initialData,
  });

  if (reviews.isPending) {
    return (
      <HomeSectionLoading>
        <LoadingList label="Loading recent critic reviews" rows={4} />
      </HomeSectionLoading>
    );
  }

  if (reviews.error) {
    return (
      <SectionError
        heading="Critic reviews are unavailable"
        onRetry={() => void reviews.refetch()}
      >
        We couldn't load the latest critic reviews. The rest of the database is
        still available.
      </SectionError>
    );
  }

  const items = reviews.data.results.flatMap((review) =>
    review.bottle
      ? [
          {
            bottleHref: `/bottles/${review.bottle.id}`,
            bottleName: review.bottle.fullName,
            date: (
              <TimeSince
                date={review.article.publishedAt ?? review.createdAt}
              />
            ),
            id: String(review.id),
            score: review.nativeScore?.display,
            source: review.site?.name ?? review.reviewerName ?? "Critic review",
            sourceHref: review.url,
          },
        ]
      : [],
  );

  return items.length ? <HomeRecentReviews reviews={items} /> : null;
}

function Regions({
  initialData,
}: {
  initialData?: Outputs["regions"]["list"];
}) {
  const orpc = useORPC();
  const regions = useQuery({
    ...orpc.regions.list.queryOptions({
      input: {
        country: "scotland",
        hasBottles: true,
        limit: 6,
        sort: "-bottles",
      },
    }),
    initialData,
  });

  if (regions.isPending) {
    return (
      <HomeSectionLoading>
        <LoadingList label="Loading whisky regions" rows={3} />
      </HomeSectionLoading>
    );
  }

  if (regions.error) {
    return (
      <SectionError
        heading="Regions are unavailable"
        onRetry={() => void regions.refetch()}
      >
        We couldn't load the region guide. Bottle search and the other homepage
        sections still work.
      </SectionError>
    );
  }

  return regions.data.results.length ? (
    <HomeRegions
      regions={regions.data.results.map((region) => ({
        description: region.description ?? undefined,
        href: `/locations/${region.country.slug}/regions/${region.slug}`,
        name: region.name,
        totalBottles: region.totalBottles,
        totalDistilleries: region.totalDistillers,
      }))}
    />
  ) : null;
}

function Distilleries({
  initialData,
  totalBlenders,
  totalBottlers,
  totalBrands,
  totalDistilleries,
}: {
  initialData?: Outputs["distilleries"]["list"];
  totalBlenders?: number;
  totalBottlers?: number;
  totalBrands?: number;
  totalDistilleries?: number;
}) {
  const orpc = useORPC();
  const distilleries = useQuery({
    ...orpc.distilleries.list.queryOptions({
      input: { limit: 12, sort: "-bottles" },
    }),
    initialData,
  });

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
        {
          href: "/blenders",
          label:
            totalBlenders === undefined
              ? "Blenders"
              : `${totalBlenders.toLocaleString("en-US")} blenders`,
        },
        { href: "/locations", label: "Map" },
      ]}
    />
  ) : null;
}

function RecentBottles({
  initialData,
  totalBottles,
}: {
  initialData?: Outputs["bottles"]["list"];
  totalBottles?: number;
}) {
  const orpc = useORPC();
  const bottles = useQuery({
    ...orpc.bottles.list.queryOptions({
      input: { limit: 3, sort: "-created" },
    }),
    initialData,
  });

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
        name: bottle.fullName,
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
