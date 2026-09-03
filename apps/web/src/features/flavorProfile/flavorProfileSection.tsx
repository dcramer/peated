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
  scope:
    | { kind: "bottle"; bottle: number }
    | { kind: "distillery"; entity: number }
    | { kind: "region"; country: string; region: string };
};

export function FlavorProfileSection({ scope }: FlavorProfileSectionProps) {
  const orpc = useORPC();
  const query = useQuery<FlavorProfile | BottleFlavorProfile>(
    scope.kind === "bottle"
      ? orpc.bottles.flavorProfile.queryOptions({
          input: { bottle: scope.bottle },
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
    ("notedTastings" in query.data
      ? query.data.notedTastings
      : query.data.notedBottles) === 0
  ) {
    return null;
  }

  return (
    <TastingWheelProvider>
      <FlavorProfileContent query={query} />
    </TastingWheelProvider>
  );
}

function FlavorProfileContent({
  query,
}: {
  query: UseQueryResult<FlavorProfile | BottleFlavorProfile>;
}) {
  const { select } = useTastingWheel();

  return (
    <RailSection heading="Flavor profile">
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
            <TextLink href="/about/tasting-wheel" tone="muted">
              About the tasting wheel
            </TextLink>
          }
          profile={query.data}
          onExplore={(category) => select({ category })}
        />
      )}
    </RailSection>
  );
}
