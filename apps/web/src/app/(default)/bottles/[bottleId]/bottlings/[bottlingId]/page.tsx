import { toTitleCase } from "@peated/server/lib/strings";
import type { Outputs } from "@peated/server/orpc/router";
import PeatedGlyph from "@peated/web/assets/glyph.svg";
import RobotImage from "@peated/web/assets/robot.png";
import BottleReviews from "@peated/web/components/bottleReviews";
import Button from "@peated/web/components/button";
import CaskDetails from "@peated/web/components/caskDetails";
import CollectionAction from "@peated/web/components/collectionAction";
import DefinitionList from "@peated/web/components/definitionList";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Heading from "@peated/web/components/heading";
import Link from "@peated/web/components/link";
import Markdown from "@peated/web/components/markdown";
import ShareButton from "@peated/web/components/shareButton";
import SimpleRatingIndicator from "@peated/web/components/simpleRatingIndicator";
import SkeletonButton from "@peated/web/components/skeletonButton";
import TastingList from "@peated/web/components/tastingList";
import TimeSince from "@peated/web/components/timeSince";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { getBottleBottlingsPath } from "@peated/web/lib/bottlings";
import { summarize } from "@peated/web/lib/markdown";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, cache, type ReactNode } from "react";
import type { Product, WithContext } from "schema-dts";
import BottleTabs from "../../bottleTabs";
import ModActions from "../../bottlingModActions";

type Bottle = Outputs["bottles"]["details"];
type Bottling = Outputs["bottleReleases"]["details"];
type TastingListData = Outputs["tastings"]["list"];

const emptyTastingList: TastingListData = {
  results: [],
  rel: {
    nextCursor: null,
    prevCursor: null,
  },
};

function formatAge(years: number | null | undefined) {
  if (!years) return null;
  return `${years} year${years === 1 ? "" : "s"}`;
}

function formatAbv(abv: number | null | undefined) {
  if (abv === null || abv === undefined) return null;
  return `${abv.toFixed(1).replace(/\.0$/, "")}%`;
}

function formatBoolean(value: boolean | null | undefined) {
  if (value === null || value === undefined) return null;
  return value ? "Yes" : "No";
}

function formatRating(avgRating: number | null | undefined) {
  if (avgRating === null || avgRating === undefined) return null;
  if (avgRating < 0.5) return "Pass";
  if (avgRating < 1.5) return "Sip";
  return "Savor";
}

function getReleaseTitle(bottling: Bottling) {
  if (bottling.edition) return bottling.edition;
  if (bottling.vintageYear) return `${bottling.vintageYear} Vintage`;
  if (bottling.releaseYear) return `${bottling.releaseYear} Bottling`;

  return bottling.fullName;
}

function getReleaseDescription(bottle: Bottle, bottling: Bottling) {
  if (bottling.description) {
    return summarize(bottling.description, 200);
  }

  const highlights = [
    formatAge(bottling.statedAge),
    formatAbv(bottling.abv),
    bottling.singleCask ? "single cask" : null,
    bottling.caskStrength ? "cask strength" : null,
  ].filter(Boolean);

  return `${getReleaseTitle(bottling)} is a specific bottling of ${bottle.fullName}${
    highlights.length ? `: ${highlights.join(", ")}.` : "."
  }`;
}

function getBottlingHighlights(bottling: Bottling) {
  return [
    bottling.vintageYear ? `${bottling.vintageYear} vintage` : null,
    bottling.releaseYear ? `bottled ${bottling.releaseYear}` : null,
    formatAge(bottling.statedAge),
    formatAbv(bottling.abv),
    bottling.singleCask ? "single cask" : null,
    bottling.caskStrength ? "cask strength" : null,
    bottling.caskFill ? toTitleCase(bottling.caskFill) : null,
    bottling.caskType ? toTitleCase(bottling.caskType) : null,
    bottling.caskSize ? toTitleCase(bottling.caskSize) : null,
  ].filter(Boolean);
}

function getBottlingMetadata(bottling: Bottling) {
  const metadata = getBottlingHighlights(bottling);
  return metadata.length ? metadata : ["Specific bottling"];
}

function parseRouteId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id < 1) {
    notFound();
  }

  return id;
}

const getBottlingPageData = cache(async function getBottlingPageData(
  bottleId: string,
  bottlingId: string,
) {
  const { client } = await getAnonymousServerClient();
  const parsedBottleId = parseRouteId(bottleId);
  const parsedBottlingId = parseRouteId(bottlingId);

  const [bottle, bottling] = await Promise.all([
    resolveOrNotFound(client.bottles.details({ bottle: parsedBottleId })),
    resolveOrNotFound(
      client.bottleReleases.details({ release: parsedBottlingId }),
    ),
  ]);

  if (bottling.bottleId !== bottle.id) {
    notFound();
  }

  return { bottle, bottling, client };
});

function ReleaseStat({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <div className="border-y border-slate-800 py-3">
      <div className="text-muted text-sm">{label}</div>
      <div className="mt-1 flex min-h-8 items-center text-2xl font-semibold tracking-tight">
        {value}
      </div>
    </div>
  );
}

function ReleaseStats({ bottling }: { bottling: Bottling }) {
  const rating = formatRating(bottling.avgRating);
  const stats = [
    { label: "Age", value: formatAge(bottling.statedAge) },
    { label: "ABV", value: formatAbv(bottling.abv) },
    { label: "Tastings", value: bottling.totalTastings.toLocaleString() },
    {
      label: "Rating",
      value: rating ? (
        <span className="inline-flex items-center gap-2">
          <SimpleRatingIndicator avgRating={bottling.avgRating} />
          {rating}
        </span>
      ) : null,
    },
    { label: "Vintage", value: bottling.vintageYear },
    { label: "Bottled", value: bottling.releaseYear },
  ].filter((stat) => stat.value !== null && stat.value !== undefined);

  if (!stats.length) return null;

  return (
    <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 xl:grid-cols-4">
      {stats.map((stat) => (
        <ReleaseStat key={stat.label} label={stat.label} value={stat.value} />
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <>
      <DefinitionList.Term>{label}</DefinitionList.Term>
      <DefinitionList.Details>{value}</DefinitionList.Details>
    </>
  );
}

function ReleaseDetails({
  bottle,
  bottling,
}: {
  bottle: Bottle;
  bottling: Bottling;
}) {
  const hasCaskDetails =
    bottling.caskFill || bottling.caskSize || bottling.caskType;

  return (
    <section>
      <Heading as="h3">Bottling Details</Heading>
      <DefinitionList>
        <DetailRow
          label="Parent Bottle"
          value={
            <Link href={`/bottles/${bottle.id}`} className="underline">
              {bottle.fullName}
            </Link>
          }
        />
        <DetailRow label="Label" value={bottling.edition} />
        <DetailRow label="Age" value={formatAge(bottling.statedAge)} />
        <DetailRow label="ABV" value={formatAbv(bottling.abv)} />
        <DetailRow label="Bottled" value={bottling.releaseYear} />
        <DetailRow label="Vintage" value={bottling.vintageYear} />
        <DetailRow
          label="Single Cask"
          value={formatBoolean(bottling.singleCask)}
        />
        <DetailRow
          label="Cask Strength"
          value={formatBoolean(bottling.caskStrength)}
        />
        <DetailRow
          label="Cask Details"
          value={
            hasCaskDetails ? (
              <CaskDetails
                caskFill={bottling.caskFill}
                caskSize={bottling.caskSize}
                caskType={bottling.caskType}
              />
            ) : null
          }
        />
        <DetailRow
          label="Added"
          value={
            bottling.createdAt ? <TimeSince date={bottling.createdAt} /> : null
          }
        />
      </DefinitionList>
    </section>
  );
}

function ReleaseImage({
  bottle,
  bottling,
}: {
  bottle: Bottle;
  bottling: Bottling;
}) {
  const imageUrl = bottling.imageUrl || bottle.imageUrl;

  if (!imageUrl) {
    return (
      <div className="flex aspect-[3/4] w-full max-w-56 items-center justify-center justify-self-center rounded border border-slate-800 bg-slate-900/40 p-6">
        <img
          src={RobotImage.src}
          className="block max-h-full max-w-full object-contain opacity-80"
          alt=""
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div className="flex aspect-[3/4] w-full max-w-56 items-center justify-center justify-self-center rounded border border-slate-800 bg-slate-900/40 p-3">
      <img
        src={imageUrl}
        className="block max-h-full max-w-full rounded object-contain"
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}

function TastingNotes({ bottling }: { bottling: Bottling }) {
  if (!bottling.tastingNotes) return null;

  return (
    <section>
      <Heading as="h3">Tasting Notes</Heading>
      <DefinitionList>
        <DetailRow label="Nose" value={bottling.tastingNotes.nose} />
        <DetailRow label="Palate" value={bottling.tastingNotes.palate} />
        <DetailRow label="Finish" value={bottling.tastingNotes.finish} />
      </DefinitionList>
    </section>
  );
}

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string; bottlingId: string }>;
}): Promise<Metadata> {
  const params = await props.params;

  const { bottleId, bottlingId } = params;

  const { bottle, bottling } = await getBottlingPageData(bottleId, bottlingId);

  const title = `${getReleaseTitle(bottling)} - ${bottle.fullName}`;
  const description = getReleaseDescription(bottle, bottling);
  const image = bottling.imageUrl || bottle.imageUrl;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : [],
    },
    twitter: {
      card: "summary",
      images: image ? [image] : [],
    },
  };
}

export default async function Page(props: {
  params: Promise<{ bottleId: string; bottlingId: string }>;
}) {
  const params = await props.params;

  const { bottleId, bottlingId } = params;

  const { bottle, bottling, client } = await getBottlingPageData(
    bottleId,
    bottlingId,
  );

  const fetchedTastingList = await client.tastings
    .list({
      bottle: bottle.id,
      release: bottling.id,
      limit: 10,
    })
    .catch(() => emptyTastingList);
  const tastingList = fetchedTastingList?.results
    ? fetchedTastingList
    : emptyTastingList;

  const releaseTitle = getReleaseTitle(bottling);
  const description = getReleaseDescription(bottle, bottling);
  const bottlingMetadata = getBottlingMetadata(bottling);
  const jsonLd: WithContext<Product> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: bottling.fullName,
    image: bottling.imageUrl || bottle.imageUrl || undefined,
    description,
    brand: {
      "@type": "Brand",
      name: bottle.brand?.name,
    },
    aggregateRating:
      bottling.avgRating !== null && bottling.totalTastings > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: bottling.avgRating,
            reviewCount: bottling.totalTastings,
          }
        : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="px-3 lg:px-0">
        <div className="grid gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="text-muted mb-2 text-sm">
              <Link
                href={getBottleBottlingsPath(bottle.id)}
                className="underline"
              >
                Bottlings
              </Link>
              <span className="mx-2">/</span>
              <Link href={`/bottles/${bottle.id}`} className="underline">
                {bottle.fullName}
              </Link>
            </div>
            <h1 className="leading-tight">
              <Link
                href={`/bottles/${bottle.id}`}
                className="text-muted block text-lg font-medium hover:underline"
              >
                {bottle.fullName}
              </Link>
              <span className="mt-1 block text-3xl font-semibold text-white">
                {releaseTitle}
              </span>
            </h1>
            <p className="text-muted mt-3 max-w-3xl">
              {bottlingMetadata.join(" · ")}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Suspense
                fallback={
                  <>
                    <SkeletonButton className="w-10" />
                    <SkeletonButton className="w-10" />
                  </>
                }
              >
                <CollectionAction
                  bottleId={bottle.id}
                  releaseId={bottling.id}
                  title="Save Bottling"
                />
              </Suspense>
              <Button
                href={getAddBottleHref({
                  bottleId: bottle.id,
                  releaseId: bottling.id,
                  intent: "tasting",
                })}
                color="primary"
              >
                <PeatedGlyph className="h-4 w-4" />
                Log Tasting
              </Button>
              <ShareButton
                title={bottling.fullName}
                url={`/bottles/${bottle.id}/bottlings/${bottling.id}`}
              />
              <Button href={getBottleBottlingsPath(bottle.id)}>
                All Bottlings
              </Button>
              <ModActions release={bottling} />
            </div>
          </div>

          <aside className="hidden lg:block">
            <ReleaseImage bottle={bottle} bottling={bottling} />
          </aside>
        </div>
      </div>

      <BottleTabs bottle={bottle} />

      <div className="px-3 lg:px-0">
        <div className="my-8 grid gap-8">
          <div className="min-w-0 space-y-8 lg:max-w-3xl">
            <ReleaseStats bottling={bottling} />

            <Suspense>
              <BottleReviews bottleId={bottle.id} releaseId={bottling.id} />
            </Suspense>

            {bottling.description ? (
              <section>
                <Heading as="h3">Summary</Heading>
                <div className="prose prose-invert -mt-1 max-w-none">
                  <Markdown content={bottling.description} />
                </div>
              </section>
            ) : null}

            <ReleaseDetails bottle={bottle} bottling={bottling} />
            <TastingNotes bottling={bottling} />

            <section>
              <Heading as="h3">Recent Tastings</Heading>
              {tastingList.results.length ? (
                <TastingList values={tastingList.results} noBottle />
              ) : (
                <EmptyActivity>
                  <div className="font-semibold">
                    No one has recorded this exact bottling yet.
                  </div>
                </EmptyActivity>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
