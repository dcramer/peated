import { trpc } from "@peated/web/lib/trpc";
import SelectField from "./selectField";

export default ({ ...props }: React.ComponentProps<typeof SelectField>) => {
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
};
