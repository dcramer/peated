import { zodResolver } from "@hookform/resolvers/zod";
import { RegionCheckConfigSchema } from "@peated/server/lib/badges/regionCheck";
import CountryField from "@peated/web/components/countryField";
import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import RegionField from "@peated/web/components/regionField";
import type { Option } from "@peated/web/components/selectField";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

type FormSchema = z.infer<typeof RegionCheckConfigSchema>;
const entityTypes = [
  { id: "brand", name: "Brand" },
  { id: "distiller", name: "Distiller" },
  { id: "bottler", name: "Bottler" },
];
export default function RegionCheckConfigForm({
  onChange,
  initialData = {},
}: {
  onChange: (data: Partial<FormSchema>) => void;
  initialData?: Partial<FormSchema>;
}) {
  const {
    control,
    getValues,
    watch,
    formState: { errors },
  } = useForm<FormSchema>({
    resolver: zodResolver(RegionCheckConfigSchema),
    defaultValues: initialData,
  });

  useEffect(() => {
    const subscription = watch((value, { name, type }) => onChange(value));
    return () => subscription.unsubscribe();
  }, [watch]);

  // TODO:
  const [countryValue, setCountryValue] = useState<Option | undefined>(
    initialData.country
      ? {
          id: initialData.country,
          name: `(Country ID: ${initialData.country})`,
        }
      : undefined,
  );

  // TODO:
  const [regionValue, setRegionValue] = useState<Option | undefined>(
    initialData.region
      ? {
          id: initialData.region,
          name: `(Region ID: ${initialData.region})`,
        }
      : undefined,
  );

  return (
    <>
      <Form>
        <Fieldset>
          <Controller
            control={control}
            name="country"
            render={({ field: { onChange, value, ref, ...field } }) => (
              <CountryField
                {...field}
                error={errors.country}
                label="Country"
                placeholder="e.g. Scotland"
                onChange={(value) => {
                  onChange(value?.id);
                  // if (regionValue?.country.id !== value?.id)
                  setRegionValue(undefined);
                  setCountryValue(value);
                }}
                value={countryValue}
              />
            )}
          />

          <Controller
            control={control}
            name="region"
            render={({ field: { onChange, value, ref, ...field } }) => (
              <RegionField
                {...field}
                error={errors.region}
                label="Region"
                placeholder="e.g. Islay, Kentucky"
                searchContext={{
                  country: getValues("country"),
                }}
                onChange={(value) => {
                  onChange(value?.id);
                  setRegionValue(value);
                }}
                value={regionValue}
                rememberValues={false}
              />
            )}
          />
        </Fieldset>
      </Form>
    </>
  );
}
