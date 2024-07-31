"use client";

import { formatBottleName } from "@peated/server/lib/format";
import { trpc } from "@peated/web/lib/trpc/client";
import SelectField from "./selectField";

export default function BottleField({
  ...props
}: React.ComponentProps<typeof SelectField>) {
  const trpcUtils = trpc.useUtils();
  return (
    <SelectField
      onQuery={async (query) => {
        const { results } = await trpcUtils.bottleList.fetch({ query });
        return results.map((r) => ({
          name: formatBottleName(r),
          id: r.id,
        }));
      }}
      {...props}
    />
  );
}
