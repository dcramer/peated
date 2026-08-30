import {
  BottleIdentityRow,
  ButtonLink,
  EmptyState,
  ItemList,
  ItemListItem,
} from "@peated/web/components/designSystem/components";
import {
  PageHeader,
  PageSection,
} from "@peated/web/components/designSystem/patterns/pageLayout.stylex";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { getBottleExpressionName } from "@peated/web/lib/bottleLabel";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { summarize } from "@peated/web/lib/markdown";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { cache } from "react";

import { FlightActions } from "./flightActions";

const getFlight = cache(async (flightId: string) => {
  const { client } = await getServerClient();
  return await resolveOrNotFound(client.flights.details({ flight: flightId }));
});

export async function generateMetadata(props: {
  params: Promise<{ flightId: string }>;
}) {
  const { flightId } = await props.params;
  const flight = await getFlight(flightId);

  return {
    title: flight.name,
    description: summarize(flight.description || "", 200),
  };
}

export default async function FlightPage(props: {
  params: Promise<{ flightId: string }>;
}) {
  const { flightId } = await props.params;
  const flight = await getFlight(flightId);

  return (
    <div>
      <PageHeader
        actions={
          <ButtonLink
            href={`/flights/${flight.id}/overlay`}
            size="md"
            variant="tonal"
          >
            Open tasting view
          </ButtonLink>
        }
        description={flight.description}
        eyebrow={flight.public ? "Public flight" : "Private flight"}
        menu={<FlightActions flight={flight} />}
        title={flight.name}
      />
      <PageSection count={flight.bottles.length} heading="Bottles">
        {flight.bottles.length ? (
          <ItemList ariaLabel="Flight bottles">
            {flight.bottles.map(({ bottle, hasTasted, isLibrary }) => (
              <ItemListItem key={bottle.id}>
                <BottleIdentityRow
                  brand={bottle.brand.name}
                  brandHref={`/entities/${bottle.brand.id}`}
                  end={
                    <ButtonLink
                      href={getAddBottleHref({
                        bottleId: bottle.id,
                        flightId: flight.id,
                        intent: "tasting",
                      })}
                      size="sm"
                      variant={hasTasted ? "tonal" : "accent"}
                    >
                      Log a tasting
                    </ButtonLink>
                  }
                  hasTasted={hasTasted}
                  href={`/bottles/${bottle.id}`}
                  imageUrl={bottle.imageUrl}
                  isLibrary={isLibrary}
                  metadata={getBottleMetadata(bottle).split(" · ")}
                  name={getBottleExpressionName(bottle)}
                />
              </ItemListItem>
            ))}
          </ItemList>
        ) : (
          <EmptyState heading="No bottles yet">
            Edit this flight to add bottles.
          </EmptyState>
        )}
      </PageSection>
    </div>
  );
}
