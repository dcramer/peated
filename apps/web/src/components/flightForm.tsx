"use client";

import { FlightInputSchema } from "@peated/server/schemas";
import type { Bottle } from "@peated/server/types";
import {
  Field,
  FormNotice,
  FormSection,
  FormStack,
  SearchPicker,
  Switch,
  Textarea,
  TextInput,
  type SearchPickerOption,
} from "@peated/web/components/designSystem/components";
import { WorkflowScreen } from "@peated/web/components/workflowScreen.stylex";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import {
  flightMembershipChanged,
  getFlightBottleIds,
} from "@peated/web/lib/flightForm";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

type FlightFormData = z.infer<typeof FlightInputSchema>;

export default function FlightForm({
  initialData = {},
  onSubmit,
  title,
}: {
  initialData?: {
    bottles?: { bottle: Bottle }[];
    description?: string | null;
    name?: string;
    public?: boolean;
  };
  onSubmit: SubmitHandler<FlightFormData>;
  title: string;
}) {
  const orpc = useORPC();
  const initialBottles = (initialData.bottles ?? []).map(
    ({ bottle }) => bottle,
  );
  const initialBottleIds = getFlightBottleIds(initialBottles);
  const [bottles, setBottles] = useState<readonly SearchPickerOption[]>(
    initialBottles.map(toBottleOption),
  );
  const [bottleQuery, setBottleQuery] = useState("");
  const [submitError, setSubmitError] = useState<string>();
  const bottleResults = useQuery(
    orpc.bottles.list.queryOptions({
      input: {
        limit: 10,
        query: bottleQuery,
        sort: bottleQuery ? "rank" : "-tastings",
      },
    }),
  );
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<FlightFormData>({
    defaultValues: {
      description: initialData.description,
      name: initialData.name,
      public: initialData.public ?? false,
    },
    resolver: zodResolver(FlightInputSchema),
  });

  const submit: SubmitHandler<FlightFormData> = async (data) => {
    setSubmitError(undefined);
    try {
      const selectedBottleIds = bottles.map(({ id }) => Number(id));
      const submission: FlightFormData = { ...data };
      if (flightMembershipChanged(initialBottleIds, selectedBottleIds)) {
        submission.bottles = selectedBottleIds;
      }
      await onSubmit(submission);
    } catch (error) {
      setSubmitError(getFormErrorMessage(error));
    }
  };

  return (
    <WorkflowScreen
      onSave={handleSubmit(submit)}
      saving={isSubmitting}
      title={title}
    >
      <form onSubmit={handleSubmit(submit)}>
        <FormStack>
          {submitError ? <FormNotice>{submitError}</FormNotice> : null}
          <FormSection title="Flight">
            <Field
              error={errors.name?.message}
              errorId="flight-name-error"
              htmlFor="flight-name"
              label="Name"
              required
            >
              <TextInput
                {...register("name")}
                aria-describedby={errors.name ? "flight-name-error" : undefined}
                autoFocus
                id="flight-name"
                invalid={Boolean(errors.name)}
                placeholder="Islay classics"
              />
            </Field>
            <Field
              error={errors.description?.message}
              htmlFor="flight-description"
              label="Description"
              optional
            >
              <Textarea
                {...register("description", {
                  setValueAs: (value) => value || null,
                })}
                id="flight-description"
                invalid={Boolean(errors.description)}
                placeholder="A short note about this lineup."
                rows={4}
              />
            </Field>
            <Controller
              control={control}
              name="public"
              render={({ field }) => (
                <Switch
                  checked={field.value ?? false}
                  description="Anyone with the link can see this flight."
                  label="Public flight"
                  name={field.name}
                  onBlur={field.onBlur}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </FormSection>
          <FormSection
            description="Add the bottles in the order you plan to taste them."
            title="Bottles"
          >
            <SearchPicker
              emptyText="No matching bottles."
              help="Search the bottle database and add each pour to the lineup."
              label="Flight bottles"
              loading={bottleResults.isFetching}
              onChange={setBottles}
              onQueryChange={setBottleQuery}
              options={(bottleResults.data?.results ?? []).map(toBottleOption)}
              placeholder="Search bottles"
              value={bottles}
            />
          </FormSection>
        </FormStack>
      </form>
    </WorkflowScreen>
  );
}

function toBottleOption(
  bottle: Pick<
    Bottle,
    "abv" | "category" | "fullName" | "id" | "noAgeStatement" | "statedAge"
  >,
): SearchPickerOption {
  return {
    detail: getBottleMetadata(bottle),
    id: bottle.id,
    label: bottle.fullName,
  };
}
