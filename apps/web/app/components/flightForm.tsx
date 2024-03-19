import { zodResolver } from "@hookform/resolvers/zod";
import { FlightInputSchema } from "@peated/server/schemas";
import type { Bottle } from "@peated/server/types";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Layout from "@peated/web/components/layout";
import TextField from "@peated/web/components/textField";
import { logError } from "@peated/web/lib/log";
import { isTRPCClientError, trpc } from "@peated/web/lib/trpc";
import { useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import Header from "./header";
import SelectField, { type Option } from "./selectField";
import Spinner from "./spinner";

const bottleToOption = (bottle: Bottle): Option => {
  return {
    id: bottle.id,
    name: bottle.fullName,
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
    bottles?: Bottle[];
  };
  title: string;
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(FlightInputSchema),
    defaultValues: {
      name: initialData.name,
      description: initialData.description,
      bottles: initialData.bottles ? initialData.bottles.map((d) => d.id) : [],
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

  const trpcUtils = trpc.useUtils();

  const [bottlesValue, setBottlesValue] = useState<Option[]>(
    initialData.bottles ? initialData.bottles.map(bottleToOption) : [],
  );

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
      {isSubmitting && (
        <div className="fixed inset-0 z-10">
          <div className="absolute inset-0 bg-slate-800 opacity-50" />
          <Spinner />
        </div>
      )}

      <form
        className="self-center bg-slate-950 pb-6 sm:mx-16 sm:my-6"
        onSubmit={handleSubmit(onSubmitHandler)}
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

          <Controller
            name="bottles"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                label="Bottles"
                {...field}
                error={errors.bottles}
                onQuery={async (query) => {
                  const { results } = await trpcUtils.bottleList.fetch({
                    query,
                  });
                  return results;
                }}
                onResults={(results) =>
                  results.map((r) => ({ id: r.id, name: r.fullName }))
                }
                onChange={(value) => {
                  onChange(value.map((t: any) => t.id || t));
                  setBottlesValue(value);
                }}
                value={bottlesValue}
                multiple
              />
            )}
          />
        </Fieldset>
      </form>
    </Layout>
  );
}
