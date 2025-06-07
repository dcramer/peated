import { zodResolver } from "@hookform/resolvers/zod";
import { EntityCheckConfigSchema } from "@peated/server/lib/badges/checks/entityCheck/schema";
import { toTitleCase } from "@peated/server/lib/strings";
import EntityField from "@peated/web/components/entityField";
import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import type { Option } from "@peated/web/components/selectField";
import SelectField from "@peated/web/components/selectField";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

type FormSchema = z.infer<typeof EntityCheckConfigSchema>;

const entityTypes = [
  { id: "brand", name: "Brand" },
  { id: "distiller", name: "Distiller" },
  { id: "bottler", name: "Bottler" },
];

export default function EntityCheckConfigForm({
  onChange,
  initialData = {},
}: {
  onChange: (data: Partial<FormSchema>) => void;
  initialData?: Partial<FormSchema>;
}) {
  const {
    control,
    watch,
    formState: { errors },
  } = useForm<FormSchema>({
    resolver: zodResolver(EntityCheckConfigSchema),
    defaultValues: initialData,
  });

  useEffect(() => {
    const subscription = watch((value, { name, type }) => onChange(value));
    return () => subscription.unsubscribe();
  }, [watch]);

  // TODO:
  const [entityValue, setEntityValue] = useState<Option | undefined>(
    initialData.entity
      ? {
          id: initialData.entity,
          name: `(Entity ID: ${initialData.entity})`,
        }
      : undefined
  );
  return (
    <>
      <Form>
        <Fieldset>
          <Controller
            name="entity"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <EntityField
                {...field}
                error={errors.entity}
                label="Entity"
                placeholder="e.g. High West Distillery"
                helpText="The entity to match on."
                canCreate={false}
                required
                onChange={(value) => {
                  onChange(value?.id);
                  setEntityValue(value);
                }}
                value={entityValue}
              />
            )}
          />
          <Controller
            name="type"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                label="Type"
                onChange={(value) => onChange(value?.id)}
                value={
                  value ? { id: value, name: toTitleCase(value) } : undefined
                }
                options={entityTypes}
                simple
                helpText="Optionally limit to bottles where the entity is of the specified type."
              />
            )}
          />
        </Fieldset>
      </Form>
    </>
  );
}
