import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "@remix-run/react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { toTitleCase } from "@peated/shared/lib/strings";
import { EntityInputSchema } from "@peated/shared/schemas";

import type { V2_MetaFunction } from "@remix-run/node";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import CountryField from "~/components/countryField";
import Fieldset from "~/components/fieldset";
import FormError from "~/components/formError";
import FormHeader from "~/components/formHeader";
import Header from "~/components/header";
import Layout from "~/components/layout";
import SelectField from "~/components/selectField";
import Spinner from "~/components/spinner";
import TextField from "~/components/textField";
import useApi from "~/hooks/useApi";
import { useSuspenseQuery } from "~/hooks/useSuspenseQuery";
import type { Entity } from "~/types";

const entityTypes = [
  { id: "brand", name: "Brand" },
  { id: "distiller", name: "Distiller" },
  { id: "bottler", name: "Bottler" },
];

type FormSchemaType = z.infer<typeof EntityInputSchema>;

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Edit Entity",
    },
  ];
};

export default function EditEntity() {
  const api = useApi();

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { entityId } = useParams();
  const { data: entity } = useSuspenseQuery(
    ["entity", entityId],
    (): Promise<Entity> => api.get(`/entities/${entityId}`),
    { cacheTime: 0 },
  );

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
    },
  });

  const onSubmit: SubmitHandler<FormSchemaType> = async (data) => {
    await saveEntity.mutateAsync(data, {
      onSuccess: () => navigate(`/entities/${entityId}`),
    });

    await saveEntity.mutateAsync(data);
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

      <form
        className="self-center bg-slate-950 pb-6 sm:mx-16 sm:my-6"
        onSubmit={handleSubmit(onSubmit)}
      >
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
        </Fieldset>
      </form>
    </Layout>
  );
}
