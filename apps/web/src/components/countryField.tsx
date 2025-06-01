"use client";

import { MAJOR_COUNTRIES } from "@peated/server/constants";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import SelectField from "./selectField";

export default function CountryField(
  props: React.ComponentProps<typeof SelectField>
) {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.countries.list.queryOptions({
      input: {
        onlyMajor: true,
        sort: "-bottles",
      },
    })
  );

  MAJOR_COUNTRIES.map(([name, slug]) => ({
    id: slug,
    name,
  }));

  return (
    <SelectField
      onQuery={async (query) => {
        const { results } = await orpc.countries.list.call({
          query,
          sort: "-bottles",
        });
        return results.map((r) => ({
          id: r.id,
          name: r.name,
        }));
      }}
      suggestedOptions={data.results}
      {...props}
    />
  );
}
