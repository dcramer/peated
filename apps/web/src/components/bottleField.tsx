"use client";

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
          name: r.fullName,
          id: r.id,
        }));
      }}
      {...props}
    />
  );
}
