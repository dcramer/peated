import type { Inputs } from "@peated/server/orpc/router";
import { useORPC } from "@peated/web/lib/orpc/context";
import SelectField from "./selectField";

export default function RegionField({
  searchContext = {},
  ...props
}: React.ComponentProps<typeof SelectField> & {
  searchContext?: {
    country?: string | number | null;
  };
}) {
  const orpc = useORPC();
  return (
    <SelectField
      onQuery={async (query) => {
        if (!searchContext.country) return [];
        const { results } = await orpc.regions.list.call({
          country: searchContext.country.toString(),
          query,
        });
        return results;
      }}
      {...props}
    />
  );
}
