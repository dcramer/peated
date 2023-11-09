import { zodResolver } from "@hookform/resolvers/zod";
import { STORE_TYPE_LIST } from "@peated/server/constants";
import { StoreInputSchema } from "@peated/server/schemas";
import type { ActionFunction } from "@remix-run/node";
import { json, redirect, type MetaFunction } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { Controller } from "react-hook-form";
import { getValidatedFormData, useRemixForm } from "remix-hook-form";
import type { SitemapFunction } from "remix-sitemap";
import type { z } from "zod";

import CountryField from "~/components/countryField";
import Fieldset from "~/components/fieldset";
import FormError from "~/components/formError";
import FormHeader from "~/components/formHeader";
import Header from "~/components/header";
import Layout from "~/components/layout";
import SelectField from "~/components/selectField";
import Spinner from "~/components/spinner";
import TextField from "~/components/textField";
import { ApiError } from "~/lib/api";
import { logError } from "~/lib/log";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

type FormSchemaType = z.infer<typeof StoreInputSchema>;

const STORE_TYPES = STORE_TYPE_LIST.map((t) => ({ id: t, name: t }));

const resolver = zodResolver(StoreInputSchema);

export const action: ActionFunction = async ({
  context: { trpc },
  request,
}) => {
  const { errors, data } = await getValidatedFormData<FormSchemaType>(
    request,
    resolver,
  );
  if (errors) {
    return json(errors);
  }

  try {
    await trpc.storeCreate.mutate(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return json({ error: err.message });
    } else {
      logError(err);
      return json({ error: "Unknown error" });
    }
  }
  return redirect(`/admin/stores`);
};

export const meta: MetaFunction = () => {
  return [
    {
      title: "Add Store",
    },
  ];
};

export default function AdminStoresAdd() {
  const { error } = useActionData<typeof action>() || {};

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useRemixForm<FormSchemaType>({
    mode: "onSubmit",
    resolver,
  });

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title="Add Store"
            saveDisabled={isSubmitting}
            onSave={handleSubmit}
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

      <Form className="sm:mx-16" onSubmit={handleSubmit}>
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
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                label="Aggregator"
                placeholder="e.g. totalwines"
                helpText="The internal implementation for this Store to aggregate prices."
                options={STORE_TYPES}
                simple
                required
                onChange={(value) => onChange(value?.id)}
                error={errors.type}
              />
            )}
          />

          <CountryField
            name="country"
            label="Country"
            control={control}
            error={errors.country}
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
