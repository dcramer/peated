"use client";

import { FlightInputSchema } from "@peated/server/schemas";
import type { Bottle } from "@peated/server/types";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormScreen from "@peated/web/components/formScreen";
import TextField from "@peated/web/components/textField";
import {
  bottleToFlightOption,
  flightMembershipChanged,
  getFlightBottleIds,
  type FlightBottleOption,
} from "@peated/web/lib/flightForm";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import Form from "./form";
import SelectField from "./selectField";

type FormSchemaType = z.infer<typeof FlightInputSchema>;

export default function FlightForm({
  onSubmit,
  initialData = {},
  title,
}: {
  onSubmit: SubmitHandler<FormSchemaType>;
  initialData?: {
    name?: string;
    description?: string | null;
    public?: boolean;
    bottles?: { bottle: Bottle }[];
  };
  title: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(FlightInputSchema),
    defaultValues: {
      name: initialData.name,
      description: initialData.description,
    },
  });

  const [error, setError] = useState<string | undefined>();

  const bottles = (initialData.bottles ?? []).map(({ bottle }) => bottle);
  const initialBottleIds = getFlightBottleIds(bottles);
  const [bottlesValue, setBottlesValue] = useState<FlightBottleOption[]>(
    bottles.map(bottleToFlightOption),
  );

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      const selectedBottleIds = bottlesValue.map(({ id }) => id);
      const submission: FormSchemaType = { ...data };
      if (flightMembershipChanged(initialBottleIds, selectedBottleIds)) {
        submission.bottles = selectedBottleIds;
      }
      await onSubmit(submission);
    } catch (err) {
      setError(getFormErrorMessage(err));
    }
  };

  const orpc = useORPC();

  return (
    <FormScreen
      title={title}
      saveDisabled={isSubmitting}
      onSave={handleSubmit(onSubmitHandler)}
    >
      <Form
        className="self-center bg-slate-950 pb-6 sm:mx-16 sm:my-6"
        onSubmit={handleSubmit(onSubmitHandler)}
        isSubmitting={isSubmitting}
      >
        {error && <FormError values={[error]} />}
        <Fieldset>
          <TextField
            {...register("name")}
            error={errors.name}
            type="text"
            label="Name"
            required
            helpText="A name for your flight."
            placeholder="e.g. Mucho Macallan"
          />

          <TextField
            {...register("description")}
            error={errors.description}
            type="text"
            label="Description"
            helpText="An optional description.."
            placeholder="e.g. 12-year-old"
          />

          <SelectField<FlightBottleOption>
            label="Bottles"
            helpText="Choose the specific Bottles included in this flight."
            error={errors.bottles}
            onQuery={async (query) => {
              const bottleList = await orpc.bottles.list.call({
                query,
                limit: 10,
                sort: query ? "rank" : "-tastings",
              });

              return bottleList.results.map(bottleToFlightOption);
            }}
            onRenderOption={(option) => <span>{option.name}</span>}
            onRenderChip={(option) => <span>{option.name}</span>}
            onChange={setBottlesValue}
            value={bottlesValue}
            multiple
          />
        </Fieldset>
      </Form>
    </FormScreen>
  );
}
