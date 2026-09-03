import { getEntityIdentityProps } from "@peated/web/lib/entityIdentity";
import { useORPC } from "@peated/web/lib/orpc/context";
import SelectField, { type Option } from "./selectField";

/** API-backed entity field for admin forms. Use EntityPicker for supplied options. */
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
        return results.map((entity) => ({
          ...entity,
          entity: getEntityIdentityProps(entity),
        }));
      }}
      {...props}
    />
  );
}
