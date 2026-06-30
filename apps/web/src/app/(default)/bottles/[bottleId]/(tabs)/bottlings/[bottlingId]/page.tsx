import { formatCategoryName } from "@peated/server/lib/format";
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
import SingleCaskChip from "@peated/web/components/singleCaskChip";
import SkeletonButton from "@peated/web/components/skeletonButton";
import TastingList from "@peated/web/components/tastingList";
import TimeSince from "@peated/web/components/timeSince";
import {
  formatBottlingName,
  getBottleBottlingsPath,
} from "@peated/web/lib/bottlings";
import { summarize } from "@peated/web/lib/markdown";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import type { Product, WithContext } from "schema-dts";
import ModActions from "../../releases/modActions";

type Bottle = Outputs["bottles"]["details"];
type Bottling = Outputs["bottleReleases"]["details"];

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
  return formatBottlingName(bottling) || bottling.fullName;
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
    formatAge(bottling.statedAge),
    formatAbv(bottling.abv),
    bottling.releaseYear ? `${bottling.releaseYear} bottling` : null,
    bottling.vintageYear ? `${bottling.vintageYear} vintage` : null,
    bottling.singleCask ? "single cask" : null,
    bottling.caskStrength ? "cask strength" : null,
    bottling.caskFill ? toTitleCase(bottling.caskFill) : null,
    bottling.caskType ? toTitleCase(bottling.caskType) : null,
    bottling.caskSize ? toTitleCase(bottling.caskSize) : null,
  ].filter(Boolean);
}

function parseRouteId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id < 1) {
    notFound();
  }

  return id;
}

async function getBottlingPageData({
  bottleId,
  bottlingId,
}: {
  bottleId: string;
  bottlingId: string;
}) {
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
}

function ReleaseStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-y border-slate-800 py-3">
      <div className="text-muted text-sm">{label}</div>
      <div className="mt-1 flex min-h-8 items-center text-2xl font-semibold tracking-tight">
        {value || "-"}
      </div>
    </div>
  );
}

function ReleaseStats({ bottling }: { bottling: Bottling }) {
  const rating = formatRating(bottling.avgRating);

  return (
    <div className="my-6 grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 xl:grid-cols-6">
      <ReleaseStat label="Age" value={formatAge(bottling.statedAge)} />
      <ReleaseStat label="ABV" value={formatAbv(bottling.abv)} />
      <ReleaseStat
        label="Tastings"
        value={bottling.totalTastings.toLocaleString()}
      />
      <ReleaseStat
        label="Rating"
        value={
          rating ? (
            <span className="inline-flex items-center gap-2">
              <SimpleRatingIndicator avgRating={bottling.avgRating} />
              {rating}
            </span>
          ) : null
        }
      />
      <ReleaseStat label="Vintage" value={bottling.vintageYear} />
      <ReleaseStat label="Bottled" value={bottling.releaseYear} />
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

function ParentBottleContext({ bottle }: { bottle: Bottle }) {
  return (
    <section>
      <Heading as="h3">Parent Bottle</Heading>
      <DefinitionList>
        <DetailRow
          label="Brand"
          value={
            <Link href={`/entities/${bottle.brand.id}`} className="underline">
              {bottle.brand.name}
            </Link>
          }
        />
        <DetailRow
          label="Category"
          value={
            bottle.category ? (
              <Link
                href={`/bottles?category=${encodeURIComponent(
                  bottle.category,
                )}`}
                className="underline"
              >
                {formatCategoryName(bottle.category)}
              </Link>
            ) : null
          }
        />
        <DetailRow
          label="Distilled At"
          value={
            bottle.distillers && bottle.distillers.length > 0 ? (
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                {bottle.distillers.map((distiller) => (
                  <Link
                    key={distiller.id}
                    href={`/entities/${distiller.id}`}
                    className="underline"
                  >
                    {distiller.name}
                  </Link>
                ))}
              </div>
            ) : null
          }
        />
        <DetailRow
          label="Bottled By"
          value={
            bottle.bottler ? (
              <Link
                href={`/entities/${bottle.bottler.id}`}
                className="underline"
              >
                {bottle.bottler.name}
              </Link>
            ) : null
          }
        />
        <DetailRow
          label="Bottlings"
          value={`${bottle.numReleases.toLocaleString()} tracked`}
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
      <img
        src={RobotImage.src}
        className="mx-auto block h-52 w-52 lg:h-64 lg:w-64"
        alt=""
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="flex w-full justify-center rounded border border-slate-900 bg-white p-3 opacity-90">
      <img
        src={imageUrl}
        className="block max-h-80 max-w-full rounded object-contain"
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

  const { bottle, bottling } = await getBottlingPageData({
    bottleId,
    bottlingId,
  });

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

  const { bottle, bottling, client } = await getBottlingPageData({
    bottleId,
    bottlingId,
  });

  const tastingList = await client.tastings.list({
    bottle: bottle.id,
    release: bottling.id,
    limit: 10,
  });

  const releaseTitle = getReleaseTitle(bottling);
  const description = getReleaseDescription(bottle, bottling);
  const bottlingHighlights = getBottlingHighlights(bottling);
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
      <div className="mt-6 px-3 lg:px-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
            <h2 className="flex flex-wrap items-center gap-2 text-3xl font-semibold leading-tight">
              {releaseTitle}
              {bottling.singleCask && <SingleCaskChip />}
            </h2>
            {bottlingHighlights.length > 0 && (
              <p className="text-muted mt-2 max-w-3xl">
                {bottlingHighlights.join(" · ")}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Suspense
              fallback={
                <>
                  <SkeletonButton className="w-10" />
                  <SkeletonButton className="w-10" />
                </>
              }
            >
              <CollectionAction bottleId={bottle.id} releaseId={bottling.id} />
            </Suspense>
            <Button
              href={`/bottles/${bottle.id}/addTasting?bottling=${bottling.id}`}
              color="primary"
            >
              <PeatedGlyph className="h-4 w-4" />
              Record a Tasting
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

        <ReleaseStats bottling={bottling} />

        <div className="my-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0 space-y-8">
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

          <aside className="space-y-8">
            <ReleaseImage bottle={bottle} bottling={bottling} />
            <ParentBottleContext bottle={bottle} />
          </aside>
        </div>
      </div>
    </>
  );
}
