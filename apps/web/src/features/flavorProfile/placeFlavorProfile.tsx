"use client";

import {
  FlavorWheel,
  LoadingPlaceholder,
  SectionError,
  TextLink,
} from "@peated/web/components";
import { RailSection } from "@peated/web/components/pages/pageLayout.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQuery } from "@tanstack/react-query";

export function PlaceFlavorProfile({
  scope,
  bottlesHref,
}: {
  scope:
    | { kind: "distillery"; entity: number }
    | { kind: "region"; country: string; region: string };
  bottlesHref: string;
}) {
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
          <FlavorWheel profile={query.data} />
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
