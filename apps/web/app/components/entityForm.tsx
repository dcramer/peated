import { zodResolver } from "@hookform/resolvers/zod";
import { toTitleCase } from "@peated/server/lib/strings";
import { EntityInputSchema } from "@peated/server/schemas";
import { type Entity } from "@peated/server/types";
import CountryField from "@peated/web/components/countryField";
import Fieldset from "@peated/web/components/fieldset";
import Form from "@peated/web/components/form";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import SelectField from "@peated/web/components/selectField";
import TextField from "@peated/web/components/textField";
import { isTRPCClientError } from "@peated/web/lib/trpc";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { logError } from "../lib/log";

const entityTypes = [
  { id: "brand", name: "Brand" },
  { id: "distiller", name: "Distiller" },
  { id: "bottler", name: "Bottler" },
];

type FormSchemaType = z.infer<typeof EntityInputSchema>;

export default function EntityForm({
  onSubmit,
  initialData = {},
  title,
}: {
  onSubmit: SubmitHandler<FormSchemaType>;
  initialData?: Partial<Entity>;
  title: string;
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(EntityInputSchema),
    defaultValues: {
      name: initialData.name,
      shortName: initialData.shortName,
      country: initialData.country,
      region: initialData.region,
      type: initialData.type,
      yearEstablished: initialData.yearEstablished,
      website: initialData.website,
    },
  });

  const [error, setError] = useState<string | undefined>();

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      await onSubmit(data);
    } catch (err) {
      if (isTRPCClientError(err)) {
        setError(err.message);
      } else {
        logError(err);
        setError("Internal error");
      }
    }
  };

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title={title}
            saveDisabled={isSubmitting}
            onSave={handleSubmit(onSubmitHandler)}
          />
        </Header>
      }
      footer={null}
    >
      <Form
        onSubmit={handleSubmit(onSubmitHandler)}
        isSubmitting={isSubmitting}
      >
        {error && <FormError values={[error]} />}

        <Fieldset>
          <TextField
            {...register("name")}
            error={errors.name}
            autoFocus
            label="Name"
            type="text"
            placeholder="e.g. Macallan"
            required
            autoComplete="off"
          />
          <TextField
            {...register("shortName")}
            error={errors.name}
            autoFocus
            label="Short Name"
            type="text"
            placeholder="e.g. MC"
            autoComplete="off"
            helpText="An abberviated name if applicable. This will take place of the full name in bottle labels."
          />
          <CountryField
            control={control}
            name="country"
            error={errors.country}
            label="Country"
            placeholder="e.g. Scotland, United States of America"
            required
          />
          <TextField
            {...register("region")}
            error={errors.region}
            label="Region"
            type="text"
            placeholder="e.g. Islay, Kentucky"
            autoComplete="off"
          />
          <Controller
            name="type"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                label="Type"
                onChange={(value) => onChange(value.map((t: any) => t.id))}
                value={value?.map((t) => ({
                  id: t,
                  name: toTitleCase(t),
                }))}
                options={entityTypes}
                simple
                multiple
              />
            )}
          />
          <TextField
            {...register("website", {
              setValueAs: (v) => (v === "" || !v ? null : v),
            })}
            error={errors.website}
            autoFocus
            label="Website"
            type="text"
            placeholder="e.g. https://example.com"
            autoComplete="off"
          />
          <TextField
            {...register("yearEstablished", {
              setValueAs: (v) => (v === "" || !v ? null : Number(v)),
            })}
            error={errors.yearEstablished}
            autoFocus
            label="Year Established"
            type="number"
            placeholder="e.g. 1969"
            autoComplete="off"
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
