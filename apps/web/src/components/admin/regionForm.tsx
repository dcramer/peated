"use client";

import { BoltIcon } from "@heroicons/react/20/solid";
import { zodResolver } from "@hookform/resolvers/zod";
import { isDefinedError } from "@orpc/client";
import { RegionInputSchema } from "@peated/server/schemas";
import { type Region } from "@peated/server/types";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import TextField from "@peated/web/components/textField";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import type { z } from "zod";
import Button from "../button";
import CountryField from "../countryField";
import Form from "../form";
import Legend from "../legend";
import { type Option } from "../selectField";
import TextAreaField from "../textAreaField";
import AdminSidebar from "./sidebar";

type FormSchemaType = z.infer<typeof RegionInputSchema>;

export default function RegionForm({
  onSubmit,
  initialData = {},
  edit = false,
  title = "Add Region",
}: {
  onSubmit: SubmitHandler<FormSchemaType>;
  initialData?: Partial<Region>;
  edit?: boolean;
  title?: string;
}) {
  const {
    getValues,
    setValue,
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(RegionInputSchema),
    defaultValues: {
      ...initialData,
      country: initialData.country ? initialData.country.id : undefined,
    },
  });

  const orpc = useORPC();
  const generateDataMutation = useMutation(
    orpc.ai.regionLookup.mutationOptions(),
  );

  const [error, setError] = useState<string | undefined>();

  const [countryValue, setCountryValue] = useState<Option | undefined>(
    initialData.country
      ? {
          id: initialData.country.id,
          name: initialData.country.name,
        }
      : undefined,
  );

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      await onSubmit(data);
    } catch (err: any) {
      if (isDefinedError(err)) {
        setError(err.message);
      } else {
        logError(err);
        setError("Internal error");
      }
    }
  };

  return (
    <Layout
      sidebar={<AdminSidebar />}
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
      {error && <FormError values={[error]} />}

      <Form
        onSubmit={handleSubmit(onSubmitHandler)}
        isSubmitting={isSubmitting}
      >
        <Fieldset>
          <TextField
            {...register("name")}
            label="Name"
            readOnly={edit}
            placeholder="e.g. Islay"
            error={errors.name}
            required
          />

          <Controller
            control={control}
            name="country"
            render={({ field: { onChange, value, ref, ...field } }) => (
              <CountryField
                {...field}
                error={errors.country}
                label="Country"
                readOnly={edit}
                placeholder="e.g. Scotland"
                onChange={(value) => {
                  onChange(value?.id);
                  setCountryValue(value);
                }}
                value={countryValue}
              />
            )}
          />
        </Fieldset>

        <Fieldset>
          <Legend title="Additional Details">
            <Button
              color="default"
              onClick={async () => {
                const result =
                  await generateDataMutation.mutateAsync(getValues());

                const currentValues = getValues();
                if (result && result.description && !currentValues.description)
                  setValue("description", result.description);
                setValue("descriptionSrc", "generated");
              }}
              disabled={generateDataMutation.isPending}
              icon={<BoltIcon className="-ml-0.5 h-4 w-4" />}
            >
              Help me fill this in [Beta]
            </Button>
          </Legend>
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
        </Fieldset>
      </Form>
    </Layout>
  );
}
