import {
  formatCategoryName,
  formatFlavorProfile,
} from "@peated/server/lib/format";
import { toTitleCase } from "@peated/server/lib/strings";
import type { Outputs } from "@peated/server/orpc/router";
import PeatedGlyph from "@peated/web/assets/glyph.svg";
import RobotImage from "@peated/web/assets/robot.png";
import BottleReviews from "@peated/web/components/bottleReviews";
import Button from "@peated/web/components/button";
import CaskDetails from "@peated/web/components/caskDetails";
import CollectionAction from "@peated/web/components/collectionAction";
import DefinitionList from "@peated/web/components/definitionList";
import Heading from "@peated/web/components/heading";
import Link from "@peated/web/components/link";
import Markdown from "@peated/web/components/markdown";
import ShareButton from "@peated/web/components/shareButton";
import SimpleRatingIndicator from "@peated/web/components/simpleRatingIndicator";
import SkeletonButton from "@peated/web/components/skeletonButton";
import TastingList from "@peated/web/components/tastingList";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import {
  formatBottlingName,
  getBottleBottlingPath,
  getBottleBottlingsPath,
} from "@peated/web/lib/bottlings";
import { summarize } from "@peated/web/lib/markdown";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, cache, type ReactNode } from "react";
import type { Product, WithContext } from "schema-dts";
import ModActions from "../../bottlingModActions";

type Bottle = Outputs["bottles"]["details"];
type Bottling = Outputs["bottleReleases"]["details"];
type BottlingList = Outputs["bottleReleases"]["list"];
type BottlingListItem = BottlingList["results"][number];
type TastingListData = Outputs["tastings"]["list"];

const emptyTastingList: TastingListData = {
  results: [],
  rel: {
    nextCursor: null,
    prevCursor: null,
  },
};

const emptyBottlingList: BottlingList = {
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

function formatProof(abv: number | null | undefined) {
  if (abv === null || abv === undefined) return null;
  const proof = abv * 2;
  return `${proof.toFixed(1).replace(/\.0$/, "")} proof`;
}

function formatStrength(abv: number | null | undefined) {
  const abvLabel = formatAbv(abv);
  const proofLabel = formatProof(abv);

  if (!abvLabel) return null;
  return proofLabel ? `${abvLabel} ABV / ${proofLabel}` : `${abvLabel} ABV`;
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

function formatDate(value: string | null | undefined) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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

function getCaskSummary(bottling: Bottling | BottlingListItem) {
  const parts = [
    bottling.singleCask ? "Single cask" : null,
    bottling.caskStrength ? "Cask strength" : null,
    bottling.caskFill ? toTitleCase(bottling.caskFill) : null,
    bottling.caskType ? toTitleCase(bottling.caskType) : null,
    bottling.caskSize ? toTitleCase(bottling.caskSize) : null,
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

function getCaskMaturationSummary(bottling: Bottling | BottlingListItem) {
  const parts = [
    bottling.caskFill ? toTitleCase(bottling.caskFill) : null,
    bottling.caskType ? toTitleCase(bottling.caskType) : null,
    bottling.caskSize ? toTitleCase(bottling.caskSize) : null,
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

function getBottlingMetadata(bottling: Bottling) {
  const metadata = getBottlingHighlights(bottling);
  return metadata.length ? metadata : ["Specific bottling"];
}

function getBottlingGroup(bottling: Bottling, releaseList: BottlingList) {
  const byId = new Map<number, Bottling | BottlingListItem>();
  releaseList.results.forEach((item) => byId.set(item.id, item));
  byId.set(bottling.id, bottling);
  return Array.from(byId.values());
}

function uniqueValues<T>(values: (T | null | undefined)[]) {
  return Array.from(
    new Set(
      values.filter(
        (value): value is T => value !== null && value !== undefined,
      ),
    ),
  );
}

function formatNumberRange(
  values: number[],
  formatter: (value: number) => string,
) {
  if (!values.length) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) return formatter(min);
  return `${formatter(min)} to ${formatter(max)}`;
}

function hasMoreBottlings(releaseList: BottlingList) {
  return releaseList.rel.nextCursor !== null;
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

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <>
      <DefinitionList.Term>{label}</DefinitionList.Term>
      <DefinitionList.Details>{value}</DefinitionList.Details>
    </>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <Heading as="h3">{title}</Heading>
      {children}
    </section>
  );
}

function FactItem({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <div className="border-t border-slate-800 py-3">
      <div className="text-muted text-xs font-medium uppercase">{label}</div>
      <div className="mt-1 min-h-6 text-base font-medium text-white">
        {value}
      </div>
    </div>
  );
}

function ExactBottlingFacts({ bottling }: { bottling: Bottling }) {
  const hasCaskDetails =
    bottling.caskFill || bottling.caskSize || bottling.caskType;

  return (
    <Section title="Exact Bottling">
      <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        <FactItem label="Batch / Edition" value={bottling.edition} />
        <FactItem label="Strength" value={formatStrength(bottling.abv)} />
        <FactItem label="Age" value={formatAge(bottling.statedAge)} />
        <FactItem label="Vintage" value={bottling.vintageYear} />
        <FactItem label="Bottled" value={bottling.releaseYear} />
        <FactItem
          label="Single Cask"
          value={formatBoolean(bottling.singleCask)}
        />
        <FactItem
          label="Cask Strength"
          value={formatBoolean(bottling.caskStrength)}
        />
        <FactItem
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
        <FactItem label="Added" value={formatDate(bottling.createdAt)} />
      </div>
    </Section>
  );
}

type ComparisonRow = {
  label: string;
  current: ReactNode;
  summary: string;
  note?: string | null;
};

function makeNumberComparison({
  label,
  current,
  siblings,
  formatter,
  missingLabel,
  minNote,
  maxNote,
  complete,
}: {
  label: string;
  current: number | null | undefined;
  siblings: (number | null | undefined)[];
  formatter: (value: number) => string;
  missingLabel: string;
  minNote: string;
  maxNote: string;
  complete: boolean;
}): ComparisonRow | null {
  const siblingValues = siblings.filter(
    (value): value is number => value !== null && value !== undefined,
  );
  const allValues = [
    ...(current !== null && current !== undefined ? [current] : []),
    ...siblingValues,
  ];
  const unique = uniqueValues(allValues);

  if (current === null || current === undefined) {
    if (!siblingValues.length) return null;
    return {
      label,
      current: missingLabel,
      summary: `Other loaded bottlings: ${formatNumberRange(
        siblingValues,
        formatter,
      )}${complete ? "" : "; more bottlings exist"}`,
    };
  }

  if (unique.length < 2) return null;

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);

  return {
    label,
    current: formatter(current),
    summary: `${complete ? "Tracked range" : "Loaded range"}: ${formatNumberRange(
      allValues,
      formatter,
    )}${complete ? "" : "; more bottlings exist"}`,
    note: complete
      ? current === min
        ? minNote
        : current === max
          ? maxNote
          : null
      : null,
  };
}

function makeTextComparison({
  label,
  current,
  siblings,
  missingLabel,
}: {
  label: string;
  current: string | null | undefined;
  siblings: (string | null | undefined)[];
  missingLabel: string;
}): ComparisonRow | null {
  const siblingValues = uniqueValues(siblings);
  const allValues = uniqueValues([
    current === null || current === undefined ? null : current,
    ...siblingValues,
  ]);

  if (!current) {
    if (!siblingValues.length) return null;
    return {
      label,
      current: missingLabel,
      summary: `Other tracked bottlings include ${siblingValues
        .slice(0, 3)
        .join(", ")}`,
    };
  }

  if (allValues.length < 2) return null;

  return {
    label,
    current,
    summary: `Other tracked bottlings include ${siblingValues
      .filter((value) => value !== current)
      .slice(0, 3)
      .join(", ")}`,
  };
}

function getComparisonRows({
  bottling,
  bottlings,
  complete,
}: {
  bottling: Bottling;
  bottlings: (Bottling | BottlingListItem)[];
  complete: boolean;
}) {
  const siblings = bottlings.filter((item) => item.id !== bottling.id);

  return [
    makeNumberComparison({
      label: "ABV / Proof",
      current: bottling.abv,
      siblings: siblings.map((item) => item.abv),
      formatter: (value) => formatStrength(value) ?? "",
      missingLabel: "No ABV recorded",
      minNote: "Lowest tracked strength",
      maxNote: "Highest tracked strength",
      complete,
    }),
    makeNumberComparison({
      label: "Age Statement",
      current: bottling.statedAge,
      siblings: siblings.map((item) => item.statedAge),
      formatter: (value) => formatAge(value) ?? "",
      missingLabel: "No age statement recorded",
      minNote: "Youngest tracked age statement",
      maxNote: "Oldest tracked age statement",
      complete,
    }),
    makeNumberComparison({
      label: "Vintage",
      current: bottling.vintageYear,
      siblings: siblings.map((item) => item.vintageYear),
      formatter: (value) => `${value}`,
      missingLabel: "No vintage recorded",
      minNote: "Earliest tracked vintage",
      maxNote: "Latest tracked vintage",
      complete,
    }),
    makeNumberComparison({
      label: "Bottled Year",
      current: bottling.releaseYear,
      siblings: siblings.map((item) => item.releaseYear),
      formatter: (value) => `${value}`,
      missingLabel: "No bottled year recorded",
      minNote: "Earliest tracked bottling",
      maxNote: "Latest tracked bottling",
      complete,
    }),
    makeTextComparison({
      label: "Single Cask",
      current: formatBoolean(bottling.singleCask),
      siblings: siblings.map((item) => formatBoolean(item.singleCask)),
      missingLabel: "Single cask status not recorded",
    }),
    makeTextComparison({
      label: "Cask Strength",
      current: formatBoolean(bottling.caskStrength),
      siblings: siblings.map((item) => formatBoolean(item.caskStrength)),
      missingLabel: "Cask strength status not recorded",
    }),
    makeTextComparison({
      label: "Cask Maturation",
      current: getCaskMaturationSummary(bottling),
      siblings: siblings.map((item) => getCaskMaturationSummary(item)),
      missingLabel: "No cask maturation details recorded",
    }),
  ].filter((row): row is ComparisonRow => row !== null);
}

function BottlingComparison({
  bottling,
  bottlings,
  complete,
}: {
  bottling: Bottling;
  bottlings: (Bottling | BottlingListItem)[];
  complete: boolean;
}) {
  if (bottlings.length < 2) return null;

  const rows = getComparisonRows({ bottling, bottlings, complete });

  return (
    <Section title="How This Bottling Compares">
      {rows.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="border-t border-slate-800 py-3 md:pr-6"
            >
              <div className="text-muted text-xs font-medium uppercase">
                {row.label}
              </div>
              <div className="mt-1 text-lg font-semibold text-white">
                {row.current}
              </div>
              <div className="text-muted mt-1 text-sm">{row.summary}</div>
              {row.note ? (
                <div className="text-highlight mt-2 text-sm font-medium">
                  {row.note}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted border-t border-slate-800 py-3 text-sm">
          More bottlings are tracked, but there is not enough recorded
          characteristic data to compare this one yet.
        </p>
      )}
    </Section>
  );
}

function OtherBottlings({
  bottleId,
  bottling,
  bottlings,
}: {
  bottleId: number;
  bottling: Bottling;
  bottlings: (Bottling | BottlingListItem)[];
}) {
  const siblings = bottlings
    .filter((item) => item.id !== bottling.id)
    .slice(0, 4);

  if (!siblings.length) return null;

  return (
    <Section title="Other Bottlings">
      <div className="divide-y divide-slate-800 border-y border-slate-800">
        {siblings.map((item) => {
          const rating = formatRating(item.avgRating);
          const meta = [
            formatStrength(item.abv),
            formatAge(item.statedAge),
            item.vintageYear ? `${item.vintageYear} vintage` : null,
            item.releaseYear ? `bottled ${item.releaseYear}` : null,
            getCaskSummary(item),
          ].filter(Boolean);

          return (
            <div
              key={item.id}
              className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <Link
                  className="font-medium text-white hover:underline"
                  href={getBottleBottlingPath(bottleId, item.id)}
                >
                  {formatBottlingName(item)}
                </Link>
                {meta.length ? (
                  <div className="text-muted mt-1 text-sm">
                    {meta.join(" · ")}
                  </div>
                ) : null}
              </div>
              <div className="text-muted flex flex-wrap items-center gap-3 text-sm sm:justify-end">
                {rating ? (
                  <span className="inline-flex items-center gap-1 text-white">
                    <SimpleRatingIndicator avgRating={item.avgRating} />
                    {rating}
                  </span>
                ) : null}
                <span>{item.totalTastings.toLocaleString()} tastings</span>
              </div>
            </div>
          );
        })}
      </div>
      {bottlings.length > siblings.length + 1 ? (
        <div className="mt-3">
          <Link
            href={getBottleBottlingsPath(bottleId)}
            className="text-muted text-sm underline hover:text-white"
          >
            View all bottlings
          </Link>
        </div>
      ) : null}
    </Section>
  );
}

function ParentBottleContext({ bottle }: { bottle: Bottle }) {
  const parentSummary = bottle.description
    ? summarize(bottle.description, 180)
    : null;
  const meta = [
    bottle.category ? formatCategoryName(bottle.category) : null,
    bottle.brand?.name,
    bottle.flavorProfile ? formatFlavorProfile(bottle.flavorProfile) : null,
  ].filter(Boolean);

  return (
    <Section title="Part of This Bottle">
      <div className="border-t border-slate-800 py-3">
        <Link
          href={`/bottles/${bottle.id}`}
          className="text-lg font-semibold text-white hover:underline"
        >
          {bottle.fullName}
        </Link>
        {meta.length ? (
          <div className="text-muted mt-1 text-sm">{meta.join(" · ")}</div>
        ) : null}
        {parentSummary ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {parentSummary}
          </p>
        ) : null}
      </div>
    </Section>
  );
}

function EmptyBottlingTastings({
  bottle,
  bottling,
}: {
  bottle: Bottle;
  bottling: Bottling;
}) {
  return (
    <div className="text-muted rounded border border-dashed border-slate-700 px-4 py-5 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div>
        <div className="font-semibold text-white">
          No one has recorded this exact bottling yet.
        </div>
        <div className="mt-1 text-sm">
          Log a tasting against {getReleaseTitle(bottling)} to keep it separate
          from the parent bottle.
        </div>
      </div>
      <div className="mt-4 sm:mt-0 sm:shrink-0">
        <Button
          href={getAddBottleHref({
            bottleId: bottle.id,
            releaseId: bottling.id,
            intent: "tasting",
          })}
        >
          <PeatedGlyph className="h-4 w-4" />
          Log Tasting
        </Button>
      </div>
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

  const [fetchedTastingList, fetchedBottlingList] = await Promise.all([
    client.tastings
      .list({
        bottle: bottle.id,
        release: bottling.id,
        limit: 10,
      })
      .catch(() => emptyTastingList),
    client.bottleReleases
      .list({
        bottle: bottle.id,
        limit: 100,
      })
      .catch(() => emptyBottlingList),
  ]);
  const tastingList = fetchedTastingList?.results
    ? fetchedTastingList
    : emptyTastingList;
  const bottlingList = fetchedBottlingList?.results
    ? fetchedBottlingList
    : emptyBottlingList;
  const bottlings = getBottlingGroup(bottling, bottlingList);
  const hasCompleteBottlingList = !hasMoreBottlings(bottlingList);

  const releaseTitle = getReleaseTitle(bottling);
  const description = getReleaseDescription(bottle, bottling);
  const bottlingMetadata = getBottlingMetadata(bottling);
  const parentMetadata = [
    bottle.category ? formatCategoryName(bottle.category) : null,
    bottle.brand?.name,
  ].filter(Boolean);
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
      <div className="border-b border-slate-800 px-3 lg:px-0">
        <div className="grid gap-6 py-6 sm:grid-cols-[minmax(0,1fr)_9rem] lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="text-muted mb-2 text-sm">
              <Link href={`/bottles/${bottle.id}`} className="underline">
                {bottle.fullName}
              </Link>
              <span className="mx-2">/</span>
              <Link
                href={getBottleBottlingsPath(bottle.id)}
                className="underline"
              >
                Bottlings
              </Link>
            </div>
            <h1 className="leading-tight">
              <Link
                href={`/bottles/${bottle.id}`}
                className="text-muted block text-lg font-medium hover:underline"
              >
                Specific bottling of {bottle.fullName}
              </Link>
              <span className="mt-1 block text-3xl font-semibold text-white">
                {releaseTitle}
              </span>
            </h1>
            <div className="text-muted mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {[...bottlingMetadata, ...parentMetadata].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
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

          <aside className="hidden sm:block">
            <ReleaseImage bottle={bottle} bottling={bottling} />
          </aside>
        </div>
      </div>

      <div className="px-3 lg:px-0">
        <div className="py-6">
          <div className="min-w-0 space-y-8 lg:max-w-4xl">
            <ExactBottlingFacts bottling={bottling} />
            <BottlingComparison
              bottling={bottling}
              bottlings={bottlings}
              complete={hasCompleteBottlingList}
            />

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

            <TastingNotes bottling={bottling} />
            <OtherBottlings
              bottleId={bottle.id}
              bottling={bottling}
              bottlings={bottlings}
            />
            <ParentBottleContext bottle={bottle} />

            <section>
              <Heading as="h3">Tastings for This Bottling</Heading>
              {tastingList.results.length ? (
                <TastingList values={tastingList.results} noBottle />
              ) : (
                <EmptyBottlingTastings bottle={bottle} bottling={bottling} />
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
