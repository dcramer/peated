import type { Inputs } from "@peated/server/orpc/router";
import Glyph from "@peated/web/assets/glyph.svg";
import BottleTable from "@peated/web/components/bottleTable";
import EmbeddedLogin from "@peated/web/components/embeddedLogin";
import EmptyActivity from "@peated/web/components/emptyActivity";
import SimpleHeader from "@peated/web/components/simpleHeader";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute({
  component: Page,
});

function Page() {
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
    orpc.tastings.list.queryOptions(queryParams),
  );

  return (
    <>
      <SimpleHeader>Tastings</SimpleHeader>

      {data.results.length > 0 ? (
        <BottleTable
          bottleList={data.results.map((t) => t.bottle)}
          rel={data.rel}
        />
      ) : (
        <EmptyActivity href="/search?tasting">
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
