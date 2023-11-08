import { zodResolver } from "@hookform/resolvers/zod";
import { STORE_TYPE_LIST } from "@peated/server/constants";
import { StoreInputSchema } from "@peated/server/schemas";
import { type MetaFunction } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { useState } from "react";
import type { SubmitHandler} from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
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
import { logError } from "~/lib/log";
import { trpc } from "~/lib/trpc";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

type FormSchemaType = z.infer<typeof StoreInputSchema>;

const STORE_TYPES = STORE_TYPE_LIST.map((t) => ({ id: t, name: t }));

const resolver = zodResolver(StoreInputSchema);

export const meta: MetaFunction = () => {
  return [
    {
      title: "Add Store",
    },
  ];
};

export default function AdminStoresAdd() {
  const navigate = useNavigate();
  const storeCreateMutation = trpc.storeCreate.useMutation();
  const [error, setError] = useState<string | undefined>();

  const onSubmitHandler: SubmitHandler<FormSchemaType> = async (data) => {
    try {
      const newFlight = await storeCreateMutation.mutateAsync(data);
      navigate(`/admin/stores`);
    } catch (err) {
      setError(`${err}`);
      logError(err);
    }
  };

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
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

      <form className="sm:mx-16" onSubmit={handleSubmit(onSubmitHandler)}>
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
      </form>
    </Layout>
  );
}
