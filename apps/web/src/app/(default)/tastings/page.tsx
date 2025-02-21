"use client";

import Glyph from "@peated/web/assets/glyph.svg";
import BottleTable from "@peated/web/components/bottleTable";
import Button from "@peated/web/components/button";
import CountryField from "@peated/web/components/countryField";
import EmbeddedLogin from "@peated/web/components/embeddedLogin";
import EmptyActivity from "@peated/web/components/emptyActivity";
import SelectField from "@peated/web/components/selectField";
import SimpleHeader from "@peated/web/components/simpleHeader";
import TextInput from "@peated/web/components/textInput";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc } from "@peated/web/lib/trpc/client";

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
  const queryParams = useApiQueryParams({
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

  const [tastingList] = trpc.tastingList.useSuspenseQuery(queryParams);

  return (
    <>
      <SimpleHeader>Tastings</SimpleHeader>

      {tastingList.results.length > 0 ? (
        <BottleTable
          bottleList={tastingList.results.map((t) => t.bottle)}
          rel={tastingList.rel}
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
