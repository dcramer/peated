import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { toTitleCase } from "@peated/shared/lib/strings";
import { EntityInputSchema } from "@peated/shared/schemas";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import CountryField from "../components/countryField";
import Fieldset from "../components/fieldset";
import FormError from "../components/formError";
import FormHeader from "../components/formHeader";
import Header from "../components/header";
import Layout from "../components/layout";
import SelectField from "../components/selectField";
import TextField from "../components/textField";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import { Entity } from "../types";

const entityTypes = [
  { id: "brand", name: "Brand" },
  { id: "distiller", name: "Distiller" },
  { id: "bottler", name: "Bottler" },
];

type FormSchemaType = z.infer<typeof EntityInputSchema>;

export default function EditEntity() {
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
      title="Edit Entity"
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
      <form className="sm:mx-16" onSubmit={handleSubmit(onSubmit)}>
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
          <Controller
            name="country"
            control={control}
            render={({ field: { ref, ...field } }) => (
              <CountryField
                {...field}
                error={errors.country}
                label="Country"
                placeholder="e.g. Scotland, United States of America"
                required
              />
            )}
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
                suggestedOptions={entityTypes}
                options={entityTypes}
                multiple
              />
            )}
          />
        </Fieldset>
      </form>
    </Layout>
  );
}
