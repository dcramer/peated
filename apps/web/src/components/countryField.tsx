"use client";

import { MAJOR_COUNTRIES } from "@peated/server/constants";
import { trpc } from "@peated/web/lib/trpc/client";
import SelectField from "./selectField";

export default function CountryField(
  props: React.ComponentProps<typeof SelectField>,
) {
  const [{ results: suggestedOptions }] = trpc.countryList.useSuspenseQuery({
    onlyMajor: true,
    sort: "-bottles",
  });

  const trpcUtils = trpc.useUtils();

  MAJOR_COUNTRIES.map(([name, slug]) => ({
    id: slug,
    name,
  }));

  return (
    <SelectField
      onQuery={async (query) => {
        const { results } = await trpcUtils.countryList.fetch({
          query,
          sort: "-bottles",
        });
        return results.map((r) => ({
          id: r.id,
          name: r.name,
        }));
      }}
      suggestedOptions={suggestedOptions}
      {...props}
    />
  );
}
