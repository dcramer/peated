"use client";

import { EventInputSchema } from "@peated/server/schemas";
import { type Event } from "@peated/server/types";
import {
  AdminFieldset as Fieldset,
  AdminFormPage as FormPage,
  AdminTextField as TextField,
} from "@peated/web/components/admin/adminForm.stylex";
import { toOption } from "@peated/web/lib/formHelpers";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useState } from "react";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import type { z } from "zod";
import CountryField from "../countryField";
import type { Option } from "../selectField";
import {
  AdminSwitchField as BooleanField,
  AdminTextareaField as TextAreaField,
} from "./adminForm.stylex";
import { useAdminFormSubmit } from "./useAdminFormSubmit";

type FormSchemaType = z.infer<typeof EventInputSchema>;

export default function EventForm({
  onSubmit,
  initialData = {},
  title = "Add Event",
  edit = false,
}: {
  onSubmit: SubmitHandler<FormSchemaType>;
  initialData?: Partial<Event>;
  title?: string;
  edit?: boolean;
}) {
  const { country, ...defaultValues } = initialData;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(EventInputSchema),
    defaultValues: {
      country: country ? country.id : null,
      ...defaultValues,
    },
  });

  const [countryValue, setCountryValue] = useState<Option | undefined>(
    toOption(country),
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
          placeholder="e.g. Fèis Ìle"
          error={errors.name}
          required
        />

        <TextField
          {...register("dateStart")}
          label="Start Date"
          type="date"
          error={errors.dateStart}
          required
        />

        <TextField
          {...register("dateEnd", {
            setValueAs: (v) => (v === "" || !v ? null : v),
          })}
          label="End Date"
          type="date"
          error={errors.dateEnd}
        />

        <BooleanField
          control={control}
          {...register("repeats")}
          label="Repeats"
          error={errors.repeats}
          helpText="Does this event repeat on the same date every year?"
        />

        <TextField
          {...register("website", {
            setValueAs: (v) => (v === "" || !v ? null : v),
          })}
          label="Website"
          error={errors.website}
        />

        <TextAreaField
          {...register("description")}
          label="Description"
          error={errors.description}
          rows={6}
        />

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
                setCountryValue(value);
              }}
              value={countryValue}
            />
          )}
        />

        <TextField
          {...register("address", {
            setValueAs: (v) => (v === "" || !v ? null : v),
          })}
          label="Venue or area"
          placeholder="e.g. Across Speyside"
          error={errors.address}
        />
      </Fieldset>
    </FormPage>
  );
}
