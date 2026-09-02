"use client";

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
import { useQuery } from "@tanstack/react-query";

type PlaceFlavorProfileProps = {
  scope:
    | { kind: "distillery"; entity: number }
    | { kind: "region"; country: string; region: string };
  bottlesHref: string;
};

export function PlaceFlavorProfile(props: PlaceFlavorProfileProps) {
  return (
    <TastingWheelProvider>
      <PlaceFlavorProfileContent {...props} />
    </TastingWheelProvider>
  );
}

function PlaceFlavorProfileContent({
  scope,
  bottlesHref,
}: PlaceFlavorProfileProps) {
  const { select } = useTastingWheel();
  const orpc = useORPC();
  const query = useQuery(
    scope.kind === "distillery"
      ? orpc.entities.flavorProfile.queryOptions({
          input: { entity: scope.entity },
        })
      : orpc.regions.flavorProfile.queryOptions({
          input: { country: scope.country, region: scope.region },
        }),
  );

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
        <>
          <FlavorWheel
            footer={
              <TextLink href="/about/tasting-wheel" tone="muted">
                About the tasting wheel
              </TextLink>
            }
            profile={query.data}
            onExplore={(category) => select({ category })}
          />
          {query.data.notedBottles < 5 ? (
            <TextLink href={bottlesHref}>
              Browse bottles to add tasting notes
            </TextLink>
          ) : null}
        </>
      )}
    </RailSection>
  );
}
