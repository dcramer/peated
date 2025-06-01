import { zodResolver } from "@hookform/resolvers/zod";
import { BottleCheckConfigSchema } from "@peated/server/lib/badges/checks/bottleCheck";
import BottleField from "@peated/web/components/bottleField";
import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import type { Option } from "@peated/web/components/selectField";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

type FormSchema = z.infer<typeof BottleCheckConfigSchema>;

export default function BottleCheckConfigForm({
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
    resolver: zodResolver(BottleCheckConfigSchema),
    defaultValues: initialData,
  });

  useEffect(() => {
    // Cant be asked to fix this right now.
    // @ts-ignore
    const subscription = watch((value, { name, type }) => onChange(value));
    return () => subscription.unsubscribe();
  }, [watch]);

  // TODO:
  const [bottleValue, setBottleValue] = useState<Option[] | undefined>(
    initialData.bottle
      ? initialData.bottle.map((i) => ({
          id: i,
          name: `(Bottle ID: ${i})`,
        }))
      : undefined
  );
  return (
    <>
      <Form>
        <Fieldset>
          <Controller
            name="bottle"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <BottleField
                {...field}
                error={errors.bottle}
                label="Bottle"
                placeholder="e.g. Glenlivet 12-year-old"
                helpText="The bottles to match on."
                canCreate={false}
                required
                multiple
                onChange={(value) => {
                  onChange(value.map((b) => b.id));
                  setBottleValue(value);
                }}
                value={bottleValue}
              />
            )}
          />
        </Fieldset>
      </Form>
    </>
  );
}
