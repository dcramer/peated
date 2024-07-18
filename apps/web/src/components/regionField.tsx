import { trpc } from "@peated/web/lib/trpc/client";
import SelectField from "./selectField";

export default function RegionField({
  searchContext = {},
  ...props
}: React.ComponentProps<typeof SelectField> & {
  searchContext?: {
    country?: string | number | null;
  };
}) {
  const trpcUtils = trpc.useUtils();
  return (
    <SelectField
      onQuery={async (query) => {
        if (!searchContext.country) return [];
        const { results } = await trpcUtils.regionList.fetch({
          country: searchContext.country,
          query,
        });
        return results;
      }}
      {...props}
    />
  );
}
