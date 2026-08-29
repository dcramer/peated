"use client";

import { BoltIcon } from "@heroicons/react/20/solid";
import { RegionInputSchema } from "@peated/server/schemas";
import { type Region } from "@peated/server/types";
import {
  AdminFieldset as Fieldset,
  AdminFormPage as FormPage,
  AdminTextField as TextField,
} from "@peated/web/components/admin/adminForm.stylex";
import { toOption } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import type { z } from "zod";
import CountryField from "../countryField";
import { type Option } from "../selectField";
import { AdminButton as Button } from "./adminButton.stylex";
import { AdminTextareaField as TextAreaField } from "./adminForm.stylex";
import { useAdminFormSubmit } from "./useAdminFormSubmit";

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

  const [countryValue, setCountryValue] = useState<Option | undefined>(
    toOption(initialData.country),
  );

  const { error, submit } = useAdminFormSubmit(onSubmit);

  return (
    <FormPage
      error={error}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit(submit)}
      title={title}
    >
      <Fieldset>
        <TextField
          {...register("name")}
          label="Name"
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

      <Fieldset
        title="Additional details"
        action={
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
            icon={<BoltIcon />}
          >
            Help me fill this in [Beta]
          </Button>
        }
      >
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
    </FormPage>
  );
}
