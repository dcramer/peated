"use client";

import type {
  BottleFlavorProfile,
  FlavorProfile,
} from "@peated/server/schemas/flavorProfile";
import {
  FlavorWheel,
  LoadingPlaceholder,
  SectionError,
  TextLink,
} from "@peated/web/components";
import { RailSection } from "@peated/web/components/pages/pageLayout.stylex";
import {
  TastingWheelProvider,
  useTastingWheel,
} from "@peated/web/features/tastingWheel/tastingWheelDetails.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

type FlavorProfileSectionProps = {
  showHeading?: boolean;
  scope:
    | { kind: "bottle"; bottle: number }
    | { kind: "distillery"; entity: number }
    | { kind: "region"; country: string; region: string }
    | { kind: "series"; series: number };
};

export function FlavorProfileSection({
  scope,
  showHeading = true,
}: FlavorProfileSectionProps) {
  const orpc = useORPC();
  const query = useQuery<FlavorProfile | BottleFlavorProfile>(
    scope.kind === "bottle"
      ? orpc.bottles.flavorProfile.queryOptions({
          input: { bottle: scope.bottle },
        })
      : scope.kind === "series"
        ? orpc.bottleSeries.flavorProfile.queryOptions({
            input: { series: scope.series },
          })
        : scope.kind === "distillery"
          ? orpc.entities.flavorProfile.queryOptions({
              input: { entity: scope.entity },
            })
          : orpc.regions.flavorProfile.queryOptions({
              input: { country: scope.country, region: scope.region },
            }),
  );

  if (
    query.isSuccess &&
    ("notedReviewAndTastingCount" in query.data
      ? query.data.notedReviewAndTastingCount
      : query.data.notedBottles) === 0
  ) {
    return null;
  }

  return (
    <TastingWheelProvider>
      <FlavorProfileContent query={query} showHeading={showHeading} />
    </TastingWheelProvider>
  );
}

function FlavorProfileContent({
  query,
  showHeading,
}: {
  query: UseQueryResult<FlavorProfile | BottleFlavorProfile>;
  showHeading: boolean;
}) {
  const { select } = useTastingWheel();

  const content = (
    <>
      {query.isPending ? (
        <div role="status" aria-label="Loading flavor profile">
          <LoadingPlaceholder preset="text" />
        </div>
      ) : query.isError ? (
        <SectionError
          heading="Could not load flavor profile"
          onRetry={() => void query.refetch()}
        >
          Try loading the tasting notes again.
        </SectionError>
      ) : (
        <FlavorWheel
          footer={
            <TextLink href="/about/tasting-wheel" size="sm" tone="muted">
              About the tasting wheel
            </TextLink>
          }
          profile={query.data}
          onExplore={(category) => select({ category })}
        />
      )}
    </>
  );

  return showHeading ? (
    <RailSection heading="Flavor profile">{content}</RailSection>
  ) : (
    <section aria-label="Flavor profile">{content}</section>
  );
}
