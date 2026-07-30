"use client";

import type { Inputs } from "@peated/server/orpc/router";
import BottleTable from "@peated/web/components/bottleTable";
import Button from "@peated/web/components/button";
import EmbeddedLogin from "@peated/web/components/embeddedLogin";
import SimpleHeader from "@peated/web/components/simpleHeader";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import useAuth from "@peated/web/hooks/useAuth";
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
        <BottleTable
          bottleList={data.results.map((tasting) => tasting.bottle)}
          rel={data.rel}
        />
      ) : (
        <div className="relative mx-3 min-h-56 overflow-hidden border border-slate-800 bg-slate-950 px-6 py-8 sm:mx-0 sm:px-10 sm:py-10">
          <img
            src="/assets/empty-tastings-illustration.webp"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-right"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/5"
            aria-hidden="true"
          />
          <div className="relative z-10 max-w-[65%] sm:max-w-sm">
            <h2 className="text-xl font-bold text-white">
              Start your tasting journal
            </h2>
            <p className="text-muted mt-2 text-sm">
              Capture the bottle, your rating, and the notes you want to
              remember.
            </p>
            <div className="mt-5">
              <Button color="highlight" href="/addBottle?intent=tasting">
                Record your first tasting
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
