import { useORPC } from "@peated/web/lib/orpc/context";
import SelectField, { type Option } from "./selectField";

export default function EntityField({
  ...props
}: React.ComponentProps<typeof SelectField<Option>>) {
  const orpc = useORPC();
  return (
    <SelectField<Option>
      onQuery={async (query) => {
        const { results } = await orpc.entities.list.call({
          query,
          limit: 25,
        });
        return results;
      }}
      {...props}
    />
  );
}
