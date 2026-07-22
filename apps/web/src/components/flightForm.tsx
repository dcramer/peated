"use client";

import type { CatalogTargetV1 } from "@peated/server/schemas";
import { FlightTargetInputSchema } from "@peated/server/schemas";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormScreen from "@peated/web/components/formScreen";
import TextField from "@peated/web/components/textField";
import {
  flightMembershipChanged,
  getFlightTargetIds,
  getFlightTargetScopeLabel,
  targetToFlightOption,
  type FlightTargetOption,
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

type FormSchemaType = z.infer<typeof FlightTargetInputSchema>;

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
    resolver: zodResolver(FlightTargetInputSchema),
    defaultValues: {
      name: initialData.name,
      description: initialData.description,
    },
  });

  const [error, setError] = useState<string | undefined>();

  const targets = (initialData.targets ?? []).map(({ target }) => target);
  const initialTargetIds = getFlightTargetIds(targets);
  const [targetsValue, setTargetsValue] = useState<FlightTargetOption[]>(
    targets.map(targetToFlightOption),
  );

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      const selectedTargetIds = targetsValue.map(({ id }) => id);
      await onSubmit({
        ...data,
        ...(flightMembershipChanged(initialTargetIds, selectedTargetIds)
          ? { targets: selectedTargetIds }
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

          <SelectField<FlightTargetOption>
            label="Bottles"
            helpText="Choose an exact Bottle, or a release family when the exact bottle is not known."
            error={errors.targets}
            onQuery={async (query) => {
              const [bottleList, groupList] = await Promise.all([
                orpc.bottles.list.call({
                  query,
                  limit: 10,
                  sort: query ? "rank" : "-tastings",
                }),
                orpc.bottleGroups.list.call({
                  query,
                  limit: 10,
                  sort: "-tastings",
                }),
              ]);

              return [
                ...bottleList.results.map((bottle) => ({
                  id: bottle.targetId,
                  kind: "bottle" as const,
                  name: bottle.fullName,
                })),
                ...groupList.results.map(targetToFlightOption),
              ];
            }}
            onRenderOption={(option) => (
              <FlightTargetOptionLabel option={option} />
            )}
            onRenderChip={(option) => (
              <FlightTargetOptionLabel option={option} />
            )}
            onChange={setTargetsValue}
            value={targetsValue}
            multiple
          />
        </Fieldset>
      </Form>
    </FormScreen>
  );
}

function FlightTargetOptionLabel({ option }: { option: FlightTargetOption }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 text-left">
      <span>{option.name}</span>
      <span className="text-muted text-xs">
        {getFlightTargetScopeLabel(option.kind)}
      </span>
    </span>
  );
}
