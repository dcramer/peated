import { zodResolver } from "@hookform/resolvers/zod";
import type { LoaderFunction } from "@remix-run/node";
import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigate, useParams } from "@remix-run/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import invariant from "tiny-invariant";
import type { z } from "zod";

import { toTitleCase } from "@peated/server/lib/strings";
import { EntityInputSchema } from "@peated/server/schemas";
import CountryField from "~/components/countryField";
import Fieldset from "~/components/fieldset";
import Form from "~/components/form";
import FormError from "~/components/formError";
import FormHeader from "~/components/formHeader";
import Header from "~/components/header";
import Layout from "~/components/layout";
import SelectField from "~/components/selectField";
import Spinner from "~/components/spinner";
import TextField from "~/components/textField";
import useApi from "~/hooks/useApi";
import { getEntity } from "~/queries/entities";

const entityTypes = [
  { id: "brand", name: "Brand" },
  { id: "distiller", name: "Distiller" },
  { id: "bottler", name: "Bottler" },
];

type FormSchemaType = z.infer<typeof EntityInputSchema>;

export const meta: MetaFunction = () => {
  return [
    {
      title: "Edit Entity",
    },
  ];
};

export const loader: LoaderFunction = async ({ params, context }) => {
  invariant(params.entityId);
  const entity = await getEntity(context.api, params.entityId);

  return json({ entity });
};

export default function EditEntity() {
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { entity } = useLoaderData<typeof loader>();
  const { entityId } = useParams();

  // TODO: move to queries
  const saveEntity = useMutation({
    mutationFn: async (data: FormSchemaType) => {
      return await api.put(`/entities/${entityId}`, {
        data,
      });
    },
    onSuccess: (newEntity) => {
      queryClient.setQueryData(["entities", entityId], newEntity);
    },
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormSchemaType>({
    resolver: zodResolver(EntityInputSchema),
    defaultValues: {
      name: entity.name,
      country: entity.country,
      region: entity.region,
      type: entity.type,
      yearEstablished: entity.yearEstablished,
      website: entity.website,
    },
  });

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    await saveEntity.mutateAsync(data, {
      onSuccess: () => navigate(`/entities/${entityId}`),
    });
  };

  return (
    <Layout
      header={
        <Header>
          <FormHeader
            title="Edit Entity"
            saveDisabled={isSubmitting}
            onSave={handleSubmit(onSubmit)}
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

      <Form onSubmit={handleSubmit(onSubmit)}>
        {saveEntity.isError && (
          <FormError values={[(saveEntity.error as Error).message]} />
        )}

        <Fieldset>
          <TextField
            {...register("name")}
            error={errors.name}
            autoFocus
            label="Name"
            type="text"
            placeholder="e.g. Macallan"
            required
            autoComplete="off"
          />
          <CountryField
            control={control}
            name="country"
            error={errors.country}
            label="Country"
            placeholder="e.g. Scotland, United States of America"
            required
          />
          <TextField
            {...register("region")}
            error={errors.region}
            label="Region"
            type="text"
            placeholder="e.g. Islay, Kentucky"
            autoComplete="off"
          />
          <Controller
            name="type"
            control={control}
            render={({ field: { onChange, value, ref, ...field } }) => (
              <SelectField
                {...field}
                label="Type"
                onChange={(value) => onChange(value.map((t: any) => t.id))}
                value={value?.map((t) => ({
                  id: t,
                  name: toTitleCase(t),
                }))}
                options={entityTypes}
                simple
                multiple
              />
            )}
          />
          <TextField
            {...register("website", {
              setValueAs: (v) => (v === "" || !v ? undefined : v),
            })}
            error={errors.website}
            autoFocus
            label="Website"
            type="text"
            placeholder="e.g. https://example.com"
            autoComplete="off"
          />
          <TextField
            {...register("yearEstablished", {
              setValueAs: (v) => (v === "" || !v ? undefined : parseInt(v, 10)),
            })}
            error={errors.yearEstablished}
            autoFocus
            label="Year Established"
            type="number"
            placeholder="e.g. 1969"
            autoComplete="off"
          />
        </Fieldset>
      </Form>
    </Layout>
  );
}
