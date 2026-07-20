"use client";

import type { Inputs } from "@peated/server/orpc/router";
import Glyph from "@peated/web/assets/glyph.svg";
import CatalogTargetIdentity from "@peated/web/components/catalogTargetIdentity";
import EmbeddedLogin from "@peated/web/components/embeddedLogin";
import EmptyActivity from "@peated/web/components/emptyActivity";
import SimpleHeader from "@peated/web/components/simpleHeader";
import SimpleRatingIndicator from "@peated/web/components/simpleRatingIndicator";
import Table from "@peated/web/components/table";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import useAuth from "@peated/web/hooks/useAuth";
import { getCatalogTargetStats } from "@peated/web/lib/catalogTarget";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export const fetchCache = "default-no-store";

export default function Page() {
  const { user } = useAuth();

  return (
    <>
      {user ? (
        <TastingList />
      ) : (
        <>
          <SimpleHeader>Tastings</SimpleHeader>
          <EmbeddedLogin />
        </>
      )}
    </>
  );
}

function TastingList() {
  const queryParams: Inputs["tastings"]["list"] = useApiQueryParams({
    numericFields: [
      "cursor",
      "limit",
      "age",
      "entity",
      "distiller",
      "bottler",
      "entity",
    ],
    overrides: {
      user: "me",
    },
  });

  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.tastings.list.queryOptions({ input: queryParams }),
  );

  return (
    <>
      <SimpleHeader>Tastings</SimpleHeader>

      {data.results.length > 0 ? (
        <Table
          items={data.results}
          primaryKey={(tasting) => String(tasting.id)}
          rel={data.rel}
          columns={[
            {
              name: "name",
              title: "Bottle",
              className: "min-w-full sm:w-1/2",
              value: (tasting) => (
                <CatalogTargetIdentity target={tasting.target} compact />
              ),
            },
            {
              name: "tastings",
              value: (tasting) =>
                getCatalogTargetStats(
                  tasting.target,
                ).totalTastings.toLocaleString(),
              className: "sm:w-24",
            },
            {
              name: "rating",
              value: (tasting) => (
                <SimpleRatingIndicator
                  avgRating={getCatalogTargetStats(tasting.target).avgRating}
                />
              ),
              className: "sm:w-20",
              align: "center",
            },
            {
              name: "age",
              value: (tasting) => {
                const age = getCatalogTargetStats(tasting.target).statedAge;
                return age ? `${age} years` : null;
              },
              className: "sm:w-24",
            },
          ]}
        />
      ) : (
        <EmptyActivity href="/addBottle?intent=tasting">
          <Glyph className="h-16 w-16" />

          <div className="mt-4 font-semibold">What are you drinking?</div>
          <div className="mt-2 block">
            Get started by recording your first tasting notes.
          </div>
        </EmptyActivity>
      )}
    </>
  );
}
