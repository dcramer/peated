"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EventInputSchema } from "@peated/server/schemas";
import { type Event } from "@peated/server/types";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormScreen from "@peated/web/components/formScreen";
import TextField from "@peated/web/components/textField";
import { getFormErrorMessage, toOption } from "@peated/web/lib/formHelpers";
import { useState } from "react";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import type { z } from "zod";
import BooleanField from "../booleanField";
import CountryField from "../countryField";
import Form from "../form";
import type { Option } from "../selectField";
import TextAreaField from "../textAreaField";
import AdminSidebar from "./sidebar";

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

  const [error, setError] = useState<string | undefined>();

  const [countryValue, setCountryValue] = useState<Option | undefined>(
    toOption(country),
  );

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      await onSubmit(data);
    } catch (err) {
      setError(getFormErrorMessage(err));
    }
  };

  return (
    <FormScreen
      title={title}
      saveDisabled={isSubmitting}
      onSave={handleSubmit(onSubmitHandler)}
      sidebar={<AdminSidebar />}
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
            placeholder="e.g. Fèis Ìle"
            error={errors.name}
          />

          <TextField
            {...register("dateStart")}
            label="Start Date"
            type="date"
            error={errors.dateStart}
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
            label="description"
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
        </Fieldset>
      </Form>
    </FormScreen>
  );
}
