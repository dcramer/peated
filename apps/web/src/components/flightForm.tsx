"use client";

import type {
  CatalogTargetV1,
  ExactCatalogTargetV1,
} from "@peated/server/schemas";
import { FlightInputSchema } from "@peated/server/schemas";
import CatalogTargetIdentity from "@peated/web/components/catalogTargetIdentity";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormField from "@peated/web/components/formField";
import FormScreen from "@peated/web/components/formScreen";
import TextField from "@peated/web/components/textField";
import {
  canEditFlightMembership,
  flightMembershipChanged,
  getFlightExactBottleIds,
} from "@peated/web/lib/flightForm";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import { zodResolver } from "@peated/web/lib/zodResolver";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import Form from "./form";
import SelectField, { type Option } from "./selectField";

const targetToOption = (target: ExactCatalogTargetV1): Option => {
  return {
    id: target.bottle.id,
    name: target.bottle.fullName,
  };
};

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
    targets?: { target: CatalogTargetV1 }[];
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

  const targets = (initialData.targets ?? []).map(({ target }) => target);
  const membershipEditable = canEditFlightMembership(targets);
  const initialBottleIds = getFlightExactBottleIds(targets);
  const [bottlesValue, setBottlesValue] = useState<Option[]>(
    targets.flatMap((target) =>
      target.kind === "bottle" ? [targetToOption(target)] : [],
    ),
  );

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      const selectedBottleIds = bottlesValue.map(({ id }) => Number(id));
      await onSubmit({
        ...data,
        ...(membershipEditable &&
        flightMembershipChanged(initialBottleIds, selectedBottleIds)
          ? { bottles: selectedBottleIds }
          : {}),
      });
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

          {membershipEditable ? (
            <SelectField
              label="Bottles"
              error={errors.bottles}
              onQuery={async (query) => {
                const { results } = await orpc.bottles.list.call({ query });
                return results;
              }}
              onResults={(results) =>
                results.map((result) => ({
                  id: result.id,
                  name: result.fullName,
                }))
              }
              onChange={setBottlesValue}
              value={bottlesValue}
              multiple
            />
          ) : (
            <FormField
              label="Bottles"
              helpText="Bottle membership can't be changed while this flight includes an unspecified bottle."
            >
              <div className="mt-1 flex flex-col items-start gap-2">
                {targets.map((target) => (
                  <CatalogTargetIdentity
                    key={target.targetId}
                    target={target}
                    compact
                  />
                ))}
              </div>
            </FormField>
          )}
        </Fieldset>
      </Form>
    </FormScreen>
  );
}
