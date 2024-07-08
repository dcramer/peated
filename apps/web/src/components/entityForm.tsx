import { BoltIcon } from "@heroicons/react/20/solid";
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
import SelectField, { type Option } from "@peated/web/components/selectField";
import TextField from "@peated/web/components/textField";
import { isTRPCClientError, trpc } from "@peated/web/lib/trpc";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import useAuth from "../hooks/useAuth";
import { logError } from "../lib/log";
import Button from "./button";
import Legend from "./legend";
import RegionField from "./regionField";
import TextAreaField from "./textAreaField";

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
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(EntityInputSchema),
    defaultValues: {
      ...initialData,
      country: initialData.country ? initialData.country.id : null,
      region: initialData.region ? initialData.region.id : null,
    },
  });

  const { user } = useAuth();

  const [error, setError] = useState<string | undefined>();

  const [countryValue, setCountryValue] = useState<Option | undefined>(
    initialData.country
      ? {
          id: initialData.country.id,
          name: initialData.country.name,
        }
      : undefined,
  );

  const [regionValue, setRegionValue] = useState<Option | undefined>(
    initialData.region
      ? {
          id: initialData.region.id,
          name: initialData.region.name,
        }
      : undefined,
  );

  const generateDataMutation = trpc.entityGenerateDetails.useMutation();

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
        </Fieldset>

        <Fieldset>
          <Legend title="Additional Details">
            {user && (user.mod || user.admin) && (
              <Button
                color="default"
                onClick={async () => {
                  const result =
                    await generateDataMutation.mutateAsync(getValues());

                  const currentValues = getValues();
                  if (
                    result &&
                    result.description &&
                    !currentValues.description
                  )
                    setValue("description", result.description);
                  setValue("descriptionSrc", "generated");
                  if (
                    result &&
                    result.yearEstablished &&
                    !currentValues.yearEstablished
                  )
                    setValue("yearEstablished", result.yearEstablished);
                }}
                disabled={generateDataMutation.isPending}
                icon={<BoltIcon className="-ml-0.5 h-4 w-4" />}
              >
                Help me fill this in [Beta]
              </Button>
            )}
          </Legend>

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

          <TextAreaField
            {...register("address")}
            error={errors.description}
            autoFocus
            label="Address"
            helpText="The address of the entity. This should be the location of the distiller or tasting room."
            placeholder="e.g. 132 Whisky Ln, Islay, Scotland, PA42 7DU"
            rows={2}
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
          {user && (user.mod || user.admin) && (
            <TextAreaField
              {...register("description", {
                setValueAs: (v) => (v === "" || !v ? null : v),
                onChange: () => {
                  setValue("descriptionSrc", "user");
                },
              })}
              error={errors.description}
              autoFocus
              label="Description"
              rows={8}
            />
          )}
        </Fieldset>
      </Form>
    </Layout>
  );
}
