"use client";

import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";

import {
  BottleComparisonTable,
  ButtonLink,
  EmptyState,
  FactList,
  LoadingList,
  SectionError,
  VerdictDistributionBar,
  type BottleComparisonRow,
  type FactListItem,
} from "@peated/web/components/designSystem/components";
import {
  PageSection,
  Panel,
  TextLink,
} from "@peated/web/components/designSystem/patterns/pagePatternShell.stylex";
import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { parseDomain } from "@peated/web/lib/urls";
import {
  colors,
  effects,
  fonts,
  space,
} from "../../../../styles/tokens.stylex";

import { getEntityPresentation, type Entity } from "./entityPageData";

type BottleList = Outputs["bottles"]["list"];

const NARROW = "@media (max-width: 759px)";

function getEntityFacts(entity: Entity): [FactListItem, ...FactListItem[]] {
  const location = entity.country ? (
    <>
      {entity.region ? (
        <>
          <a
            href={`/locations/${entity.country.slug}/regions/${entity.region.slug}`}
            {...stylex.props(styles.factLink)}
          >
            {entity.region.name}
          </a>
          <span>, </span>
        </>
      ) : null}
      <a
        href={`/locations/${entity.country.slug}`}
        {...stylex.props(styles.factLink)}
      >
        {entity.country.name}
      </a>
    </>
  ) : null;

  return [
    {
      label: "Website",
      value: entity.website ? (
        <a
          href={entity.website}
          rel="noreferrer"
          target="_blank"
          {...stylex.props(styles.factLink)}
        >
          {parseDomain(entity.website)}
        </a>
      ) : null,
    },
    { label: "Location", value: location },
    { label: "Address", value: entity.address },
    { label: "Also known as", value: entity.shortName },
  ];
}

function formatBottleMetadata(bottle: BottleList["results"][number]) {
  const origins = [
    ...new Set(
      bottle.distillers
        .map((distiller) => distiller.region?.name ?? distiller.country?.name)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const origin =
    origins.length === 1
      ? origins[0]
      : bottle.category
        ? formatCategoryName(bottle.category)
        : null;

  return [
    origin,
    bottle.statedAge !== null
      ? `${bottle.statedAge} years`
      : bottle.noAgeStatement
        ? "NAS"
        : null,
    bottle.abv !== null ? `${formatAbv(bottle.abv)}% ABV` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function formatAbv(abv: number) {
  return abv.toFixed(1).replace(/\.0$/, "");
}

function toBottleTableRow(
  bottle: BottleList["results"][number],
): BottleComparisonRow {
  return {
    href: `/bottles/${bottle.id}`,
    id: bottle.peatedId,
    metadata: formatBottleMetadata(bottle),
    name: bottle.fullName,
    values: [
      bottle.totalScores > 0 && bottle.avgScore !== null
        ? bottle.avgScore.toLocaleString("en-US", {
            maximumFractionDigits: 1,
          })
        : null,
      bottle.ratingStats.total > 0 ? (
        <VerdictDistributionBar
          key={`${bottle.id}-verdicts`}
          pass={bottle.ratingStats.pass}
          savor={bottle.ratingStats.savor}
          sip={bottle.ratingStats.sip}
        />
      ) : null,
    ],
  };
}

function EntityBottleOverview({
  bottleList,
  createBottleHref,
  entity,
  error,
  pending,
  retry,
  totalBottles,
}: {
  bottleList?: BottleList;
  createBottleHref?: string;
  entity: Entity;
  error: boolean;
  pending: boolean;
  retry: () => void;
  totalBottles: number;
}) {
  const presentation = getEntityPresentation(entity);
  const ownsBottleModule =
    entity.kind === "brand" ||
    entity.kind === "bottler" ||
    entity.kind === "distillery" ||
    entity.kind === "blender";

  if (!ownsBottleModule) return null;

  if (pending) {
    return (
      <PageSection heading={presentation.bottleSectionLabel}>
        <LoadingList label="Loading associated bottles" rows={4} />
      </PageSection>
    );
  }

  if (error) {
    return (
      <PageSection heading={presentation.bottleSectionLabel}>
        <SectionError
          heading="Associated bottles are unavailable"
          onRetry={retry}
        >
          The entity record is still available. Try loading its bottles again.
        </SectionError>
      </PageSection>
    );
  }

  if (!bottleList?.results.length) {
    const isBottling = presentation.bottleSectionLabel === "Bottlings";
    const bottleNoun = isBottling ? "bottling" : "bottle";
    const recordHref =
      createBottleHref ??
      `/bottles/new?${new URLSearchParams({
        returnTo: `/entities/${entity.id}`,
      }).toString()}`;

    return (
      <PageSection heading={presentation.bottleSectionLabel}>
        <EmptyState
          action={
            <ButtonLink href={recordHref} size="sm" variant="accent">
              Record a {bottleNoun}
            </ButtonLink>
          }
          heading={isBottling ? "No bottlings yet" : "No bottles yet"}
        >
          No {presentation.bottleSectionLabel.toLowerCase()} have been recorded
          for {entity.name} yet.
        </EmptyState>
      </PageSection>
    );
  }

  const [firstBottle, ...remainingBottles] = bottleList.results;

  return (
    <PageSection
      count={bottleList.results.length}
      heading={presentation.bottleSectionLabel}
      intro={
        <TextLink href={`/entities/${entity.id}/bottles?sort=-tastings`}>
          View all {totalBottles.toLocaleString("en-US")} bottles
        </TextLink>
      }
    >
      <BottleComparisonTable
        ariaLabel={`${entity.name} ${presentation.bottleSectionLabel.toLowerCase()}`}
        columns={["Community score", "Verdicts"]}
        rows={[
          toBottleTableRow(firstBottle),
          ...remainingBottles.map(toBottleTableRow),
        ]}
      />
    </PageSection>
  );
}

export function EntityOverviewClient({
  initialEntity,
}: {
  initialEntity: Entity;
}) {
  const orpc = useORPC();
  const entityQuery = useQuery({
    ...orpc.entities.details.queryOptions({
      input: { entity: initialEntity.id },
    }),
    initialData: initialEntity,
  });
  const bottleListQuery = useQuery(
    orpc.bottles.list.queryOptions({
      input: {
        entity: initialEntity.id,
        limit: 4,
        sort: "-tastings",
      },
    }),
  );

  if (entityQuery.error) {
    return (
      <SectionError
        heading="Entity details are unavailable"
        onRetry={() => void entityQuery.refetch()}
      >
        We could not load this entity. Try again.
      </SectionError>
    );
  }

  const entity = entityQuery.data;
  const createBottleHref = getEntityBottleCreateHref(entity);

  return (
    <div {...stylex.props(styles.overviewGrid)}>
      <aside {...stylex.props(styles.details)}>
        <PageSection heading="Details">
          <Panel>
            <FactList facts={getEntityFacts(entity)} />
          </Panel>
        </PageSection>
      </aside>

      <div {...stylex.props(styles.catalog)}>
        <EntityBottleOverview
          bottleList={bottleListQuery.data}
          createBottleHref={createBottleHref}
          entity={entity}
          error={Boolean(bottleListQuery.error)}
          pending={bottleListQuery.isPending}
          retry={() => void bottleListQuery.refetch()}
          totalBottles={entity.totalBottles}
        />
      </div>
    </div>
  );
}

const styles = stylex.create({
  overviewGrid: {
    display: "grid",
    gridTemplateAreas: {
      default: '"catalog details"',
      [NARROW]: '"details" "catalog"',
    },
    gridTemplateColumns: {
      default: "minmax(0, 1fr) 336px",
      [NARROW]: "minmax(0, 1fr)",
    },
    columnGap: space.x12,
  },
  catalog: {
    gridArea: "catalog",
    minWidth: 0,
  },
  details: {
    gridArea: "details",
    minWidth: 0,
  },
  factLink: {
    color: colors.accentDeep,
    outline: "none",
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
});
