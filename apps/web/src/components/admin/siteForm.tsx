import { zodResolver } from "@hookform/resolvers/zod";
import { EXTERNAL_SITE_TYPE_LIST } from "@peated/server/constants";
import { ExternalSiteSchemaInputSchema } from "@peated/server/schemas";
import { type ExternalSite } from "@peated/server/types";
import Fieldset from "@peated/web/components/fieldset";
import FormError from "@peated/web/components/formError";
import FormHeader from "@peated/web/components/formHeader";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import SelectField from "@peated/web/components/selectField";
import TextField from "@peated/web/components/textField";
import { logError } from "@peated/web/lib/log";
import { isTRPCClientError } from "@peated/web/lib/trpc";
import { useState } from "react";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import type { z } from "zod";
import Form from "../form";

type FormSchemaType = z.infer<typeof ExternalSiteSchemaInputSchema>;

const SITE_TYPES = EXTERNAL_SITE_TYPE_LIST.map((t) => ({ id: t, name: t }));

export default function SiteForm({
  onSubmit,
  initialData = {},
}: {
  onSubmit: SubmitHandler<FormSchemaType>;
  initialData?: Partial<ExternalSite>;
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(ExternalSiteSchemaInputSchema),
    defaultValues: initialData,
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

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title="Add Site"
            saveDisabled={isSubmitting}
            onSave={handleSubmit(onSubmitHandler)}
          />
        </Header>
      }
      footer={null}
    >
      <Form
        className="sm:mx-16"
        onSubmit={handleSubmit(onSubmitHandler)}
        isSubmitting={isSubmitting}
      >
        {error && <FormError values={[error]} />}

        <Fieldset>
          <TextField
            {...register("name")}
            label="Name"
            placeholder="e.g. Total Wines"
            error={errors.name}
          />

          <Controller
            name="type"
            control={control}
            render={({ field: { onChange, ref, value, ...field } }) => (
              <SelectField
                {...field}
                label="Aggregator"
                value={value ? { id: value, name: value } : null}
                placeholder="e.g. totalwine"
                helpText="The internal implementation for this site to aggregate prices."
                options={SITE_TYPES}
                simple
                required
                onChange={(value) => onChange(value?.id)}
                error={errors.type}
              />
            )}
          />

          <TextField
            {...register("runEvery", {
              setValueAs: (v) => (v === "" || !v ? null : Number(v)),
            })}
            label="Frequency"
            type="number"
            min="30"
            helpText="The frequency to run the scraper (in minutes)."
            placeholder="e.g. 60"
            error={errors.runEvery}
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
